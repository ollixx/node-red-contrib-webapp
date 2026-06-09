import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * P106 — live model delivery on deploy.
 *
 * On a flow deploy (`flows:started`) the server pushes the freshly-compiled
 * snapshot to every connected client over the existing SSE channel, tagged with
 * a shell/topology SIGNATURE and the app's deploy MODE (development/production).
 * The client decides in-place vs reload (development) or shows a version alert
 * (production). These tests drive the real webapp.js helpers:
 *
 *  - computeShellSignature: same shell/routes → same signature; changed
 *    shell/route-set → different signature.
 *  - the deploy push: a `deploy` SSE frame carrying { snapshot, signature, mode }
 *    reaches every subscribed client (broadcast).
 */

const require = createRequire(import.meta.url);

const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
        >;
        runtimeState: {
            liveState: Map<string, unknown>;
            clientStateMap: Map<string, unknown>;
            streamClients: Map<string, Map<string, { res: unknown; location: string }>>;
            definitions: Map<string, unknown>;
            RED: unknown;
        };
        addStreamClient: (appId: string, clientId: string, res: unknown, location: string) => void;
        computeShellSignature: (appId: string, definitions: unknown[]) => string;
        pushDeployToClients: (appId: string, definitions: unknown[]) => void;
        resolveAppMode: (appId: string, definitions: unknown[]) => string;
    };
};

const {
    runtimeNodeRegistry,
    runtimeState,
    addStreamClient,
    computeShellSignature,
    pushDeployToClients,
    resolveAppMode
} = webapp.__test__;

const APP_ID = "deployApp";

const BASE_FLOW = [
    { type: "ui-app", id: APP_ID, name: "Deploy App", root: APP_ID, layout: "app", z: "fl" },
    { type: "ui-route", id: "r-customers", parent: APP_ID, path: "/customers", layoutId: "vertical", z: "fl" },
    {
        type: "ui-text",
        id: "label1",
        mount: APP_ID + ".content",
        order: 1,
        value: { kind: "literal", value: "before" },
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
            return frames
                .join("")
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

function definitionsFrom(flow: Record<string, unknown>[]) {
    return flow.map((node) => ({
        ...runtimeNodeRegistry[node.type as string].mapConfig(node),
        z: node.z
    }));
}

beforeEach(() => {
    userDir = mkdtempSync(join(tmpdir(), "webapp-p106-"));
    writeFileSync(join(userDir, "flows.json"), JSON.stringify(BASE_FLOW), "utf8");

    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    runtimeState.streamClients.clear();
    runtimeState.definitions.clear();

    runtimeState.RED = {
        settings: { userDir, flowFile: "flows.json" },
        nodes: { getNode: () => undefined }
    };
});

afterEach(() => {
    runtimeState.RED = undefined;
    rmSync(userDir, { recursive: true, force: true });
});

describe("P106: shell/topology signature", () => {
    it("identical shell + route set yields an identical signature", () => {
        const a = computeShellSignature(APP_ID, definitionsFrom(BASE_FLOW));
        const b = computeShellSignature(APP_ID, definitionsFrom(BASE_FLOW));
        expect(a).toBe(b);
        expect(a.length).toBeGreaterThan(0);
    });

    it("a pure content change (label text) does NOT change the signature", () => {
        const before = computeShellSignature(APP_ID, definitionsFrom(BASE_FLOW));

        const changed = BASE_FLOW.map((n) =>
            n.id === "label1" ? { ...n, value: { kind: "literal", value: "after" } } : n
        );
        const after = computeShellSignature(APP_ID, definitionsFrom(changed));
        expect(after).toBe(before);
    });

    it("adding a route changes the signature (topology change → reload)", () => {
        const before = computeShellSignature(APP_ID, definitionsFrom(BASE_FLOW));

        const withRoute = [
            ...BASE_FLOW,
            { type: "ui-route", id: "r-orders", parent: APP_ID, path: "/orders", layoutId: "vertical", z: "fl" }
        ];
        const after = computeShellSignature(APP_ID, definitionsFrom(withRoute));
        expect(after).not.toBe(before);
    });

    it("changing the app layout preset changes the signature (shell change → reload)", () => {
        const before = computeShellSignature(APP_ID, definitionsFrom(BASE_FLOW));

        const reskinned = BASE_FLOW.map((n) =>
            n.id === APP_ID ? { ...n, layout: "vertical" } : n
        );
        const after = computeShellSignature(APP_ID, definitionsFrom(reskinned));
        expect(after).not.toBe(before);
    });

    it("changing a theme token changes the signature (shell change → reload)", () => {
        const before = computeShellSignature(APP_ID, definitionsFrom(BASE_FLOW));

        const themed = BASE_FLOW.map((n) =>
            n.id === APP_ID ? { ...n, tokens: JSON.stringify({ "color-primary": "#ff0000" }) } : n
        );
        const after = computeShellSignature(APP_ID, definitionsFrom(themed));
        expect(after).not.toBe(before);
    });
});

describe("P106: deploy push (development mode default)", () => {
    it("broadcasts a `deploy` frame carrying snapshot + signature + mode to every subscriber", () => {
        const a = makeFakeRes();
        const b = makeFakeRes();
        addStreamClient(APP_ID, "ca", a, "/customers");
        addStreamClient(APP_ID, "cb", b, "/customers");

        pushDeployToClients(APP_ID, definitionsFrom(BASE_FLOW));

        for (const res of [a, b]) {
            const deploys = res.events().filter((e) => e.event === "deploy");
            expect(deploys).toHaveLength(1);
            const data = deploys[0].data as { snapshot?: unknown; signature?: string; mode?: string };
            expect(data.snapshot).toBeTruthy();
            expect(typeof data.signature).toBe("string");
            expect(data.signature!.length).toBeGreaterThan(0);
            expect(data.mode).toBe("development");
        }
    });

    it("the pushed deploy snapshot reflects the freshly-compiled model (new label text)", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const changed = BASE_FLOW.map((n) =>
            n.id === "label1" ? { ...n, value: { kind: "literal", value: "fresh-content" } } : n
        );
        pushDeployToClients(APP_ID, definitionsFrom(changed));

        const deploy = res.events().find((e) => e.event === "deploy")!;
        expect(JSON.stringify(deploy.data)).toContain("fresh-content");
    });

    it("the deploy frame carries the SAME signature computeShellSignature returns for the same definitions", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const defs = definitionsFrom(BASE_FLOW);
        pushDeployToClients(APP_ID, defs);

        const deploy = res.events().find((e) => e.event === "deploy")!;
        const data = deploy.data as { signature: string };
        expect(data.signature).toBe(computeShellSignature(APP_ID, defs));
    });
});

describe("P106: production mode", () => {
    it("resolveAppMode returns 'production' when the ui-app status is Produktion", () => {
        const prodFlow = BASE_FLOW.map((n) =>
            n.id === APP_ID ? { ...n, deployMode: "production" } : n
        );
        expect(resolveAppMode(APP_ID, definitionsFrom(prodFlow))).toBe("production");
    });

    it("resolveAppMode defaults to 'development' when status is unset", () => {
        expect(resolveAppMode(APP_ID, definitionsFrom(BASE_FLOW))).toBe("development");
    });

    it("a production app still broadcasts a deploy frame, tagged mode=production", () => {
        const res = makeFakeRes();
        addStreamClient(APP_ID, "c1", res, "/");

        const prodFlow = BASE_FLOW.map((n) =>
            n.id === APP_ID ? { ...n, deployMode: "production" } : n
        );
        pushDeployToClients(APP_ID, definitionsFrom(prodFlow));

        const deploy = res.events().find((e) => e.event === "deploy")!;
        expect((deploy.data as { mode: string }).mode).toBe("production");
    });
});

describe("P106: ui-app mode mapConfig", () => {
    it("maps deployMode='production' to mode='production' on the definition", () => {
        const def = runtimeNodeRegistry["ui-app"].mapConfig({
            id: APP_ID,
            name: "x",
            root: APP_ID,
            layout: "app",
            deployMode: "production"
        });
        expect(def.mode).toBe("production");
    });

    it("honours the legacy `status` alias when `deployMode` is absent", () => {
        const def = runtimeNodeRegistry["ui-app"].mapConfig({
            id: APP_ID,
            name: "x",
            root: APP_ID,
            layout: "app",
            status: "production"
        });
        expect(def.mode).toBe("production");
    });

    it("defaults mode to 'development' when deployMode is absent", () => {
        const def = runtimeNodeRegistry["ui-app"].mapConfig({
            id: APP_ID,
            name: "x",
            root: APP_ID,
            layout: "app"
        });
        expect(def.mode).toBe("development");
    });
});
