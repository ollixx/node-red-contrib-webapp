import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P31 — live Server→Client transport (SSE; see docs/adr/0003).
 *
 * A flow message that updates a ui-store, or a ui-action triggered from the flow,
 * is pushed to the relevant connected client(s) over the live channel — NO client
 * POST is involved. clientId targeting honours the P15 multi-user model: a push
 * addressed to one client never reaches another.
 *
 * These tests drive the real webapp.js helpers. A flow file on disk supplies the
 * deploy definitions (the runtime reads them to build the pushed snapshot), and a
 * fake SSE `res` records every frame the runtime writes to a subscriber.
 */

const require = createRequire(import.meta.url);

interface StoreNode {
    id: string;
    webappDefinition: Record<string, unknown>;
}

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
            endpointsRegistered: boolean;
        };
        addStreamClient: (appId: string, clientId: string, res: unknown, location: string) => void;
        pushSnapshotToClients: (appId: string, clientId: string | undefined, definitions: unknown[]) => void;
        pushActionCommandToClients: (
            appId: string,
            clientId: string | undefined,
            command: Record<string, unknown>
        ) => void;
        buildActionCommand: (
            actionDefinition: Record<string, unknown> | undefined,
            msg: Record<string, unknown>
        ) => Record<string, unknown> | null;
        actionInputHandler: (node: unknown, msg: unknown, send: unknown, done: unknown) => void;
        getClientState: (appId: string, clientId: string) => { state: unknown; timestamp: number } | null;
    };
};

const {
    runtimeNodeRegistry,
    runtimeState,
    addStreamClient,
    pushSnapshotToClients,
    pushActionCommandToClients,
    buildActionCommand,
    actionInputHandler,
    getClientState
} = webapp.__test__;

const APP_ID = "liveApp";

// A flow on disk: an app + home route + a ui-store and a ui-text bound to it,
// so a store update is observable in the rendered snapshot.
const FLOW = [
    { type: "ui-app", id: APP_ID, name: "Live App", root: APP_ID, layout: "app", z: "fl" },
    { type: "ui-store", id: "greetingStore", parent: APP_ID, statePath: "greeting", z: "fl" },
    {
        type: "ui-text",
        id: "greetingText",
        mount: APP_ID + ".content",
        order: 1,
        value: { kind: "state", path: "greeting" },
        z: "fl"
    }
];

let userDir: string;

// A fake SSE response that records the frames the runtime writes.
function makeFakeRes() {
    const frames: string[] = [];
    return {
        frames,
        write(chunk: string) {
            frames.push(chunk);
        },
        // Parse the recorded frames into { event, data } messages (ignore the
        // initial ":ok" comment and keep-alive comments).
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

function deployDefinitions() {
    // Mirror readDeployDefinitions: map raw flow nodes through mapConfig.
    return FLOW.map((node) => ({ ...runtimeNodeRegistry[node.type].mapConfig(node), z: node.z }));
}

beforeEach(() => {
    userDir = mkdtempSync(join(tmpdir(), "webapp-p31-"));
    writeFileSync(join(userDir, "flows.json"), JSON.stringify(FLOW), "utf8");

    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    runtimeState.streamClients.clear();
    runtimeState.definitions.clear();

    // Register the app so getActiveRuntimeAppId() resolves.
    runtimeState.definitions.set(APP_ID, {
        nodeId: APP_ID,
        appId: APP_ID,
        definition: { type: "ui-app", id: APP_ID }
    });

    // A stub RED whose flow file is the temp deploy.
    runtimeState.RED = {
        settings: { userDir, flowFile: "flows.json" },
        nodes: { getNode: () => undefined }
    };
});

afterEach(() => {
    runtimeState.RED = undefined;
    rmSync(userDir, { recursive: true, force: true });
});

function storeNode() {
    return {
        id: "greetingStore",
        webappDefinition: runtimeNodeRegistry["ui-store"].mapConfig(FLOW[1] as Record<string, unknown>)
    } as StoreNode;
}

function snapshotText(event: { data: unknown }): string {
    return JSON.stringify(event.data);
}

describe("P31: a flow ui-store update pushes a re-render to the subscribed client (no client POST)", () => {
    it("a msg into the ui-store input handler pushes a snapshot reflecting the new data", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            storeNode(),
            { ui: { store: { id: "greetingStore", op: "set", value: "Hello live" }, clientId: "c1" } },
            send,
            done
        );

        const pushed = res.events().filter((e) => e.event === "snapshot");
        expect(pushed.length).toBeGreaterThanOrEqual(1);
        // The pushed snapshot reflects the new store value.
        expect(snapshotText(pushed[pushed.length - 1])).toContain("Hello live");
        // Per-client state was mutated by the flow message — the source of truth.
        expect((getClientState(APP_ID, "c1")!.state as Record<string, unknown>).greeting).toBe("Hello live");
        expect(done).toHaveBeenCalled();
    });

    it("a broadcast store update (no clientId) pushes to every subscriber", () => {
        const a = makeFakeRes();
        const b = makeFakeRes();
        addStreamClient(APP_ID, "ca", a, "/");
        addStreamClient(APP_ID, "cb", b, "/");

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            storeNode(),
            { ui: { store: { id: "greetingStore", op: "set", value: "Broadcast" } } },
            vi.fn(),
            vi.fn()
        );

        expect(snapshotText(a.events().filter((e) => e.event === "snapshot").pop()!)).toContain("Broadcast");
        expect(snapshotText(b.events().filter((e) => e.event === "snapshot").pop()!)).toContain("Broadcast");
    });
});

describe("P31: a flow ui-action pushes an interaction command to the client", () => {
    it("a navigate action triggered from the flow pushes a navigate command and updates the client's stream location", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const actionNode = {
            id: "goDetail",
            webappDefinition: { type: "ui-action", id: "goDetail", actionType: "navigate", to: "/detail" }
        };

        actionInputHandler(
            actionNode,
            { ui: { clientId: "c1", action: {} } },
            vi.fn(),
            vi.fn()
        );

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "navigate", to: "/detail" } });
        // The server now remembers this client is on /detail for subsequent pushes.
        expect(runtimeState.streamClients.get(APP_ID)!.get("c1")!.location).toBe("/detail");
    });

    it("an openDialog command is pushed verbatim for the client to apply", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        pushActionCommandToClients(APP_ID, "c1", { type: "openDialog", target: "editDialog" });

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "openDialog", target: "editDialog" } });
    });

    it("buildActionCommand maps the action definition to the documented interaction verb", () => {
        const command = buildActionCommand(
            { type: "ui-action", id: "a", actionType: "navigate", to: "/x" },
            { ui: {} }
        );
        // P53: the command now also carries an optional `part` (open/close/select
        // granularity); undefined when not specified.
        expect(command).toEqual({ type: "navigate", to: "/x", target: undefined, part: undefined });
    });
});

// P53 (ADR 0005): the canonical interaction verb set + target/part granularity.
describe("P53: ui-action interaction verb vocabulary", () => {
    it("buildActionCommand emits show/hide/enable/disable with the resolved target", () => {
        for (const verb of ["show", "hide", "enable", "disable", "focus", "reset"]) {
            const command = buildActionCommand(
                { type: "ui-action", id: "a", actionType: verb, target: "panel1" },
                { ui: {} }
            );
            expect(command).toEqual({ type: verb, to: undefined, target: "panel1", part: undefined });
        }
    });

    it("buildActionCommand carries `part` for open/close granularity (accordion section)", () => {
        const command = buildActionCommand(
            { type: "ui-action", id: "a", actionType: "open", target: "acc1", part: "section2" },
            { ui: {} }
        );
        expect(command).toEqual({ type: "open", to: undefined, target: "acc1", part: "section2" });
    });

    it("msg.ui.action overrides win for type / target / part", () => {
        const command = buildActionCommand(
            { type: "ui-action", id: "a", actionType: "show", target: "static" },
            { ui: { action: { type: "hide", targetId: "dynamic", part: "branchX" } } }
        );
        expect(command).toEqual({ type: "hide", to: undefined, target: "dynamic", part: "branchX" });
    });

    it("an open command with target+part is pushed verbatim to the client", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        pushActionCommandToClients(APP_ID, "c1", { type: "open", target: "acc1", part: "s2" });

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "open", target: "acc1", part: "s2" } });
    });

    it("the ui-action OUTPUT passes the incoming msg through UNCHANGED (wire chaining; effect rides the SSE command channel only)", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const actionNode = {
            id: "showPanel",
            webappDefinition: { type: "ui-action", id: "showPanel", actionType: "show", target: "panel1" }
        };

        const incoming = { topic: "t", payload: { keep: 42 }, ui: { clientId: "c1", action: {} } };
        const send = vi.fn();
        actionInputHandler(actionNode, incoming, send, vi.fn());

        // The interaction effect went out over the SSE command channel …
        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "show", target: "panel1" } });

        // … and the wire output forwarded the ORIGINAL msg, not a command-bearing one.
        expect(send).toHaveBeenCalledTimes(1);
        const forwarded = send.mock.calls[0][0];
        expect(forwarded).toBe(incoming);
        expect(forwarded.payload).toEqual({ keep: 42 });
        expect(forwarded.topic).toBe("t");
    });
});

describe("P31: clientId targeting — a push to one client does not reach another", () => {
    it("a store update addressed to c1 pushes only to c1, never to c2", () => {
        const r1 = makeFakeRes();
        const r2 = makeFakeRes();
        addStreamClient(APP_ID, "c1", r1, "/");
        addStreamClient(APP_ID, "c2", r2, "/");

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            storeNode(),
            { ui: { store: { id: "greetingStore", op: "set", value: "OnlyForC1" }, clientId: "c1" } },
            vi.fn(),
            vi.fn()
        );

        expect(r1.events().filter((e) => e.event === "snapshot").length).toBeGreaterThanOrEqual(1);
        // c2 received NOTHING — the snapshot was addressed to c1 only.
        expect(r2.events().filter((e) => e.event === "snapshot")).toHaveLength(0);
    });

    it("an action command addressed to one client does not reach another", () => {
        const r1 = makeFakeRes();
        const r2 = makeFakeRes();
        addStreamClient(APP_ID, "c1", r1, "/");
        addStreamClient(APP_ID, "c2", r2, "/");

        pushActionCommandToClients(APP_ID, "c2", { type: "navigate", to: "/only-c2" });

        expect(r1.events().filter((e) => e.event === "command")).toHaveLength(0);
        expect(r2.events().filter((e) => e.event === "command")).toHaveLength(1);
    });

    it("pushSnapshotToClients with an unknown clientId is a no-op (no error, no leak)", () => {
        const r1 = makeFakeRes();
        addStreamClient(APP_ID, "c1", r1, "/");
        pushSnapshotToClients(APP_ID, "ghost", deployDefinitions());
        expect(r1.events()).toHaveLength(0);
    });
});
