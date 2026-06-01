import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";


const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        runtimeState: {
            liveState: Map<string, unknown>;
            clientStateMap: Map<string, Map<string, { state: unknown; timestamp: number }>>;
            definitions: Map<string, { nodeId: string; definition: Record<string, unknown> }>;
            RED: unknown;
        };
        getClientState: (appId: string, clientId: string) => { state: unknown; timestamp: number } | null;
        setClientState: (appId: string, clientId: string, state: unknown, timestamp: number) => void;
        resolveReconnectState: (
            serverEntry: { state: unknown; timestamp: number } | null,
            clientSnapshot: { state: unknown; timestamp: number }
        ) => { winner: "server" | "client"; state: unknown; timestamp: number };
        applyStoreOperation: (
            state: Record<string, unknown>,
            storeDefinition: Record<string, unknown>,
            operation: Record<string, unknown>
        ) => { nextState: Record<string, unknown>; notification: unknown };
    };
};

const { runtimeNodeRegistry, runtimeState, getClientState, setClientState, resolveReconnectState } = webapp.__test__;

function makeStoreNode(id: string, statePath: string) {
    return {
        id,
        webappDefinition: { type: "ui-store", id, statePath, initialValue: null }
    };
}

function makeMsg(storeId: string, op: string, value: unknown, clientId?: string) {
    const ui: Record<string, unknown> = {
        store: { id: storeId, op, value }
    };
    if (clientId !== undefined) {
        ui.clientId = clientId;
    }
    return { ui };
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    runtimeState.definitions.clear();
});

// ---------------------------------------------------------------------------
// P15: ui-store schema — persist field
// ---------------------------------------------------------------------------

describe("P15: ui-store schema — persist field", () => {
    it("mapConfig forwards persist=true", () => {
        const def = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "s1",
            statePath: "session",
            persist: true
        }) as Record<string, unknown>;

        expect(def.persist).toBe(true);
    });

    it("mapConfig forwards persist=false (string 'false')", () => {
        const def = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "s1",
            statePath: "session",
            persist: false
        }) as Record<string, unknown>;

        expect(def.persist).toBe(false);
    });

    it("mapConfig defaults persist to false when absent", () => {
        const def = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "s1",
            statePath: "session"
        }) as Record<string, unknown>;

        expect(def.persist).toBe(false);
    });

    it("mapConfig accepts persist as string 'true'", () => {
        const def = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "s1",
            statePath: "session",
            persist: "true"
        }) as Record<string, unknown>;

        expect(def.persist).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// P15: clientId routing
// ---------------------------------------------------------------------------

describe("P15: clientId routing — store input handler", () => {
    it("store update with clientId only updates per-client state, not shared state", () => {
        const appId = "app1";
        runtimeState.definitions.set("app1-node", {
            nodeId: "app1-node",
            appId,
            definition: { type: "ui-app", id: appId }
        });

        const node = makeStoreNode("store1", "draft");
        const send = vi.fn();
        const done = vi.fn();
        const msg = makeMsg("store1", "set", { name: "Alice" }, "c1");

        runtimeNodeRegistry["ui-store"].options.inputHandler(node, msg, send, done);

        // The shared liveState must remain untouched when a clientId is present.
        expect(runtimeState.liveState.has(appId)).toBe(false);

        // Per-client state must be set
        const clientEntry = getClientState(appId, "c1");
        expect(clientEntry).not.toBeNull();
        expect((clientEntry!.state as Record<string, unknown>).draft).toEqual({ name: "Alice" });
    });

    it("store update with clientId sends notification with clientId preserved", () => {
        const appId = "app1";
        runtimeState.definitions.set("app1-node", {
            nodeId: "app1-node",
            appId,
            definition: { type: "ui-app", id: appId }
        });

        const node = makeStoreNode("store1", "draft");
        const send = vi.fn();
        const msg = makeMsg("store1", "set", { name: "Alice" }, "c1");

        runtimeNodeRegistry["ui-store"].options.inputHandler(node, msg, send, vi.fn());

        expect(send).toHaveBeenCalledOnce();
        const outMsg = send.mock.calls[0][0] as Record<string, unknown>;
        expect((outMsg.ui as Record<string, unknown>).store).toMatchObject({ clientId: "c1" });
    });

    it("store update without clientId updates shared state and does not set clientId on notification", () => {
        const appId = "app1";
        runtimeState.definitions.set("app1-node", {
            nodeId: "app1-node",
            appId,
            definition: { type: "ui-app", id: appId }
        });

        const node = makeStoreNode("store1", "draft");
        const send = vi.fn();
        const msg = makeMsg("store1", "set", { name: "Bob" });

        runtimeNodeRegistry["ui-store"].options.inputHandler(node, msg, send, vi.fn());

        // Broadcast: liveState is updated so future page loads and all SSE subscribers see it.
        const liveState = runtimeState.liveState.get(appId) as Record<string, unknown>;
        expect(liveState.draft).toEqual({ name: "Bob" });

        // Notification must not carry a clientId
        const outMsg = send.mock.calls[0][0] as Record<string, unknown>;
        expect((outMsg.ui as Record<string, unknown>).store).not.toHaveProperty("clientId", expect.anything());
    });

    it("different clients have independent per-client states", () => {
        const appId = "app1";
        runtimeState.definitions.set("app1-node", {
            nodeId: "app1-node",
            appId,
            definition: { type: "ui-app", id: appId }
        });

        const node = makeStoreNode("store1", "draft");

        runtimeNodeRegistry["ui-store"].options.inputHandler(node, makeMsg("store1", "set", { name: "Alice" }, "c1"), vi.fn(), vi.fn());
        runtimeNodeRegistry["ui-store"].options.inputHandler(node, makeMsg("store1", "set", { name: "Bob" }, "c2"), vi.fn(), vi.fn());

        const c1 = getClientState(appId, "c1");
        const c2 = getClientState(appId, "c2");

        expect((c1!.state as Record<string, unknown>).draft).toEqual({ name: "Alice" });
        expect((c2!.state as Record<string, unknown>).draft).toEqual({ name: "Bob" });
    });
});

// ---------------------------------------------------------------------------
// P15: reconnect sync logic
// ---------------------------------------------------------------------------

describe("P15: reconnect sync — resolveReconnectState", () => {
    it("client timestamp newer than server → client wins", () => {
        const serverEntry = { state: { draft: { name: "Old" } }, timestamp: 1000 };
        const clientSnapshot = { state: { draft: { name: "New" } }, timestamp: 2000 };

        const result = resolveReconnectState(serverEntry, clientSnapshot);

        expect(result.winner).toBe("client");
        expect((result.state as Record<string, unknown>).draft).toEqual({ name: "New" });
    });

    it("server timestamp newer than client → server wins", () => {
        const serverEntry = { state: { draft: { name: "ServerValue" } }, timestamp: 5000 };
        const clientSnapshot = { state: { draft: { name: "OldClientValue" } }, timestamp: 1000 };

        const result = resolveReconnectState(serverEntry, clientSnapshot);

        expect(result.winner).toBe("server");
        expect((result.state as Record<string, unknown>).draft).toEqual({ name: "ServerValue" });
    });

    it("equal timestamps → server wins (conflict: server wins)", () => {
        const serverEntry = { state: { draft: "server" }, timestamp: 3000 };
        const clientSnapshot = { state: { draft: "client" }, timestamp: 3000 };

        const result = resolveReconnectState(serverEntry, clientSnapshot);

        expect(result.winner).toBe("server");
    });

    it("no server entry → client state accepted", () => {
        const clientSnapshot = { state: { session: "fresh" }, timestamp: 9999 };

        const result = resolveReconnectState(null, clientSnapshot);

        expect(result.winner).toBe("client");
        expect((result.state as Record<string, unknown>).session).toBe("fresh");
    });
});

// ---------------------------------------------------------------------------
// P15: setClientState / getClientState helpers
// ---------------------------------------------------------------------------

describe("P15: clientState helpers", () => {
    it("getClientState returns null for unknown client", () => {
        expect(getClientState("app1", "nonexistent")).toBeNull();
    });

    it("setClientState then getClientState returns stored entry", () => {
        setClientState("app1", "c1", { foo: "bar" }, 1234);
        const entry = getClientState("app1", "c1");
        expect(entry).not.toBeNull();
        expect((entry!.state as Record<string, unknown>).foo).toBe("bar");
        expect(entry!.timestamp).toBe(1234);
    });

    it("setClientState overwrites previous entry for same clientId", () => {
        setClientState("app1", "c1", { v: 1 }, 100);
        setClientState("app1", "c1", { v: 2 }, 200);
        const entry = getClientState("app1", "c1");
        expect((entry!.state as Record<string, unknown>).v).toBe(2);
        expect(entry!.timestamp).toBe(200);
    });
});
