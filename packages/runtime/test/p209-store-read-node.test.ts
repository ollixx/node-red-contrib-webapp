import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * P209 (ADR 0028) — ui-store-read: on-demand, NON-mutating store reader.
 *
 * Every incoming message triggers a read of the CURRENT server state at the
 * referenced store's statePath (+ optional sub-path). Path precedence:
 *   msg.ui.store.path › msg.path › config path › (none = whole slice).
 * Per-client via msg.ui.clientId; a client-only store read without a clientId is
 * a structured server.store.scope-violation error. Output:
 *   msg.payload = <value>  AND
 *   msg.ui.store = { id, event:"read", path, fullPath, value, clientId }.
 * Non-mutating: no liveState / clientState write.
 */

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            {
                mapConfig: (config: Record<string, unknown>) => Record<string, unknown>;
                options: {
                    inputHandler: (
                        node: unknown,
                        msg: unknown,
                        send: (msg: unknown) => void,
                        done: (err?: Error) => void
                    ) => void;
                };
            }
        >;
        runtimeState: {
            liveState: Map<string, unknown>;
            clientStateMap: Map<string, Map<string, { state: unknown; timestamp: number }>>;
            definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
            streamClients: Map<string, unknown>;
            RED: unknown;
        };
    };
};

const { runtimeNodeRegistry, runtimeState } = webapp.__test__;

const APP_ID = "testApp209";
const STORE_ID = "store209";

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({
        id: APP_ID,
        root: APP_ID,
        name: "Test App",
        layout: "app"
    });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def });
}

function registerStore(statePath: string, scope?: string) {
    const config: Record<string, unknown> = { id: STORE_ID, parent: APP_ID, statePath };
    if (scope !== undefined) { config.scope = scope; }
    const def = runtimeNodeRegistry["ui-store"].mapConfig(config);
    runtimeState.definitions.set(STORE_ID, { nodeId: STORE_ID, appId: APP_ID, definition: def });
    return def;
}

function makeReadNode(path?: string) {
    const config: Record<string, unknown> = { id: "read209", parent: APP_ID, store: STORE_ID };
    if (path !== undefined) { config.path = path; }
    const def = runtimeNodeRegistry["ui-store-read"].mapConfig(config);
    return {
        id: "read209",
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(msg: string) { this.errors.push(msg); },
        warn(msg: string) { this.warns.push(msg); }
    };
}

function seedBroadcast(state: unknown) {
    runtimeState.liveState.set(APP_ID, state);
}

function seedClient(clientId: string, state: unknown) {
    runtimeState.clientStateMap.set(APP_ID, new Map([[clientId, { state, timestamp: Date.now() }]]));
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    runtimeState.RED = { log: { error: vi.fn(), warn: vi.fn() } };
});

// ---------------------------------------------------------------------------
// mapConfig round-trip
// ---------------------------------------------------------------------------

describe("P209: ui-store-read mapConfig", () => {
    it("maps store + path + parent; blank path → undefined", () => {
        const def = runtimeNodeRegistry["ui-store-read"].mapConfig({
            id: "r1", parent: APP_ID, store: STORE_ID, path: ""
        });
        expect(def).toMatchObject({ type: "ui-store-read", id: "r1", parent: APP_ID, store: STORE_ID });
        expect(def.path).toBeUndefined();
    });

    it("carries a non-blank config path", () => {
        const def = runtimeNodeRegistry["ui-store-read"].mapConfig({
            id: "r2", parent: APP_ID, store: STORE_ID, path: "name"
        });
        expect(def.path).toBe("name");
    });
});

// ---------------------------------------------------------------------------
// Path precedence — all four cases
// ---------------------------------------------------------------------------

describe("P209: path precedence msg.ui.store.path › msg.path › config › whole slice", () => {
    beforeEach(() => {
        registerApp();
        registerStore("entity");
        seedBroadcast({ entity: { name: "A", city: "X" } });
    });

    it("no path anywhere → whole slice at statePath", () => {
        const node = makeReadNode();
        const send = vi.fn();
        node && runtimeNodeRegistry["ui-store-read"].options.inputHandler(node, { ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { payload: unknown; ui: { store: Record<string, unknown> } };
        expect(out.payload).toEqual({ name: "A", city: "X" });
        expect(out.ui.store).toMatchObject({ id: STORE_ID, event: "read", fullPath: "entity", value: { name: "A", city: "X" } });
        expect(out.ui.store.path).toBeUndefined();
    });

    it("config path wins when no msg override", () => {
        const node = makeReadNode("city");
        const send = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(node, { ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { payload: unknown; ui: { store: Record<string, unknown> } };
        expect(out.payload).toBe("X");
        expect(out.ui.store).toMatchObject({ path: "city", fullPath: "entity.city", value: "X" });
    });

    it("msg.path overrides config path", () => {
        const node = makeReadNode("city");
        const send = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(node, { path: "name", ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { payload: unknown; ui: { store: Record<string, unknown> } };
        expect(out.payload).toBe("A");
        expect(out.ui.store).toMatchObject({ path: "name", fullPath: "entity.name" });
    });

    it("msg.ui.store.path wins over msg.path and config", () => {
        const node = makeReadNode("city");
        const send = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(
            node, { path: "name", ui: { store: { path: "city" } } }, send, vi.fn()
        );
        const out = send.mock.calls[0][0] as { payload: unknown; ui: { store: Record<string, unknown> } };
        expect(out.payload).toBe("X");
        expect(out.ui.store).toMatchObject({ path: "city", fullPath: "entity.city" });
    });
});

// ---------------------------------------------------------------------------
// Per-client read
// ---------------------------------------------------------------------------

describe("P209: per-client read", () => {
    it("reads the per-client slice for msg.ui.clientId (not broadcast)", () => {
        registerApp();
        registerStore("entity", "client-only");
        seedBroadcast({ entity: { name: "A", city: "X" } });
        seedClient("c1", { entity: { name: "B", city: "X" } });

        const node = makeReadNode();
        const send = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(
            node, { ui: { clientId: "c1" } }, send, vi.fn()
        );
        const out = send.mock.calls[0][0] as { payload: unknown; ui: { store: Record<string, unknown> } };
        expect(out.payload).toEqual({ name: "B", city: "X" });
        expect(out.ui.store).toMatchObject({ clientId: "c1", value: { name: "B", city: "X" } });
    });

    it("with msg.path='name' returns the per-client sub-value 'B'", () => {
        registerApp();
        registerStore("entity", "client-only");
        seedClient("c1", { entity: { name: "B", city: "X" } });

        const node = makeReadNode();
        const send = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(
            node, { path: "name", ui: { clientId: "c1" } }, send, vi.fn()
        );
        const out = send.mock.calls[0][0] as { payload: unknown };
        expect(out.payload).toBe("B");
    });
});

// ---------------------------------------------------------------------------
// Scope guard + non-mutation
// ---------------------------------------------------------------------------

describe("P209: scope guard & non-mutation", () => {
    it("client-only store read WITHOUT clientId → server.store.scope-violation, no send", () => {
        registerApp();
        registerStore("entity", "client-only");
        seedBroadcast({ entity: { name: "A", city: "X" } });

        const node = makeReadNode();
        const send = vi.fn();
        const done = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(node, { ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.scope-violation");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("broadcast-only store read WITH clientId → scope-violation", () => {
        registerApp();
        registerStore("shared", "broadcast-only");
        seedBroadcast({ shared: { name: "A" } });

        const node = makeReadNode();
        const send = vi.fn();
        const done = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(
            node, { ui: { clientId: "c9" } }, send, done
        );

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.scope-violation");
    });

    it("unknown referenced store → structured read-missing-store error", () => {
        registerApp();
        // no store registered
        const node = makeReadNode();
        const send = vi.fn();
        const done = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(node, { ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.read-missing-store");
    });

    it("does not mutate broadcast or per-client state", () => {
        registerApp();
        registerStore("entity");
        seedBroadcast({ entity: { name: "A", city: "X" } });
        const before = JSON.stringify(runtimeState.liveState.get(APP_ID));

        const node = makeReadNode("name");
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(node, { ui: {} }, vi.fn(), vi.fn());

        expect(JSON.stringify(runtimeState.liveState.get(APP_ID))).toBe(before);
        // mutating the emitted value must not reach back into stored state
        const send2 = vi.fn();
        runtimeNodeRegistry["ui-store-read"].options.inputHandler(node, { ui: {} }, send2, vi.fn());
        const out = send2.mock.calls[0][0] as { payload: string };
        expect(out.payload).toBe("A");
    });
});
