import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P52 — dynamic grid placement via input message (ADR 0004, option A).
 *
 * A flow can change a view node's grid placement (row / col / colSize / rowSize)
 * at runtime through its input port (msg.ui.patch), and the re-placement reaches
 * connected clients in the pushed snapshot. The P51 positive-integer invariant is
 * enforced ON THIS PATH too: an invalid placement value is rejected (the key is
 * dropped from the patch) and the node raises a clear error — it is never applied.
 *
 * layoutX / layoutY are NOT subject to the positive-integer rule (0 is the
 * legitimate absolute-layout origin).
 */

const require = createRequire(import.meta.url);

const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            {
                mapConfig: (config: Record<string, unknown>) => Record<string, unknown>;
                options: { inputHandler: (node: unknown, msg: unknown, send: unknown, done: unknown) => void };
            }
        >;
        runtimeState: {
            liveState: Map<string, unknown>;
            clientStateMap: Map<string, unknown>;
            streamClients: Map<string, Map<string, { res: unknown; location: string }>>;
            definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
            RED: unknown;
        };
        addStreamClient: (appId: string, clientId: string, res: unknown, location: string) => void;
        viewNodePatchInputHandler: (node: unknown, msg: unknown, send: unknown, done: unknown) => void;
        readDeployDefinitions: (RED: unknown) => Array<Record<string, unknown>>;
    };
};

const {
    runtimeNodeRegistry,
    runtimeState,
    addStreamClient,
    viewNodePatchInputHandler,
    readDeployDefinitions
} = webapp.__test__;

const APP_ID = "gridApp";

// An app on a GRID layout with a ui-text mounted into it carrying a grid
// placement. The serializer only emits grid-column/grid-row CSS when the layout
// variant is "grid", so the placement is observable in the snapshot HTML.
const FLOW = [
    { type: "ui-app", id: APP_ID, name: "Grid App", root: APP_ID, layout: "grid", z: "fl" },
    {
        type: "ui-text",
        id: "tile",
        mount: APP_ID + ".content",
        order: 1,
        col: 2,
        row: 1,
        colSize: 3,
        value: { kind: "literal", value: "Tile" },
        z: "fl"
    }
];

let userDir: string;

function makeFakeRes() {
    const frames: string[] = [];
    return {
        frames,
        write(chunk: string) {
            frames.push(chunk);
        },
        events(): Array<{ event: string; data: unknown }> {
            const text = frames.join("");
            return text
                .split("\n\n")
                .filter((block) => block.includes("event:"))
                .map((block) => {
                    const lines = block.split("\n");
                    const eventLine = lines.find((l) => l.startsWith("event: "))!;
                    const dataLine = lines.find((l) => l.startsWith("data: "))!;
                    return {
                        event: eventLine.slice("event: ".length),
                        data: JSON.parse(dataLine.slice("data: ".length))
                    };
                });
        }
    };
}

function tileNode() {
    return {
        id: "tile",
        z: "fl",
        webappDefinition: runtimeNodeRegistry["ui-text"].mapConfig(FLOW[1] as Record<string, unknown>),
        errors: [] as string[],
        error(line: string) {
            (this as { errors: string[] }).errors.push(line);
        }
    };
}

function lastSnapshotText(res: ReturnType<typeof makeFakeRes>): string {
    const snaps = res.events().filter((e) => e.event === "snapshot");
    return JSON.stringify(snaps[snaps.length - 1]?.data ?? null);
}

beforeEach(() => {
    userDir = mkdtempSync(join(tmpdir(), "webapp-p52-"));
    writeFileSync(join(userDir, "flows.json"), JSON.stringify(FLOW), "utf8");

    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    runtimeState.streamClients.clear();
    runtimeState.definitions.clear();

    // Register the app + the tile node so findAppIdForNode() and the live merge resolve.
    runtimeState.definitions.set(APP_ID, {
        nodeId: APP_ID,
        appId: APP_ID,
        definition: { type: "ui-app", id: APP_ID }
    });
    runtimeState.definitions.set("tile", {
        nodeId: "tile",
        appId: APP_ID,
        definition: runtimeNodeRegistry["ui-text"].mapConfig(FLOW[1] as Record<string, unknown>)
    });

    runtimeState.RED = {
        settings: { userDir, flowFile: "flows.json" },
        nodes: { getNode: (id: string) => (id === APP_ID ? { z: "fl" } : undefined) }
    };
});

afterEach(() => {
    runtimeState.RED = undefined;
    rmSync(userDir, { recursive: true, force: true });
});

describe("P52: a placement patch re-places the element in the pushed snapshot", () => {
    it("a valid col/row patch reaches the snapshot HTML (grid-column updated)", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        viewNodePatchInputHandler(
            tileNode(),
            { ui: { patch: { col: 5, colSize: 2 } } },
            vi.fn(),
            vi.fn()
        );

        const text = lastSnapshotText(res);
        // The pushed snapshot is the structured RenderSnapshot — the new placement
        // rides in the component's props.layout (the thin client serializes that
        // into grid-column:5 / span 2 CSS on apply).
        expect(text).toContain('"col":5');
        expect(text).toContain('"colSize":2');
        // And the live definition the deploy-merge produces carries the new col.
        const merged = readDeployDefinitions(runtimeState.RED).find((d) => d.id === "tile")!;
        expect(merged.col).toBe(5);
        expect(merged.colSize).toBe(2);
    });
});

describe("P52: the P51 positive-integer invariant holds on the patch path", () => {
    for (const bad of [0, -3, 1.5]) {
        it(`rejects col=${bad} — not applied, node error raised`, () => {
            const res = makeFakeRes();
            addStreamClient(APP_ID, "c1", res, "/");
            const node = tileNode();

            viewNodePatchInputHandler(
                node,
                { ui: { patch: { col: bad } } },
                vi.fn(),
                vi.fn()
            );

            // The bad value is never applied — col stays at the deploy value (2).
            const merged = readDeployDefinitions(runtimeState.RED).find((d) => d.id === "tile")!;
            expect(merged.col).toBe(2);
            // A clear node error was raised.
            expect(node.errors.length).toBeGreaterThanOrEqual(1);
            expect(node.errors.join(" ")).toMatch(/positive integer/i);
        });
    }

    it("a mixed patch keeps valid keys and drops only the invalid placement key", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");
        const node = tileNode();

        viewNodePatchInputHandler(
            node,
            { ui: { patch: { col: 7, row: -1 } } },
            vi.fn(),
            vi.fn()
        );

        const merged = readDeployDefinitions(runtimeState.RED).find((d) => d.id === "tile")!;
        // valid col applied
        expect(merged.col).toBe(7);
        // invalid row dropped — stays at deploy value (1)
        expect(merged.row).toBe(1);
        expect(node.errors.length).toBeGreaterThanOrEqual(1);
    });

    it("layoutX/layoutY are NOT subject to the positive-integer rule (0 is valid)", () => {
        const node = tileNode();

        viewNodePatchInputHandler(
            node,
            { ui: { patch: { layoutX: 0, layoutY: 0 } } },
            vi.fn(),
            vi.fn()
        );

        // No error — absolute origin 0 is legitimate.
        expect(node.errors.length).toBe(0);
        const merged = readDeployDefinitions(runtimeState.RED).find((d) => d.id === "tile")!;
        expect(merged.layoutX).toBe(0);
        expect(merged.layoutY).toBe(0);
    });
});
