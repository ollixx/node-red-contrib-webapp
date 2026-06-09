import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * P110 — ui-store: scope-Guard (Any / Broadcast Only / Client Only)
 *
 * A `scope` field on ui-store declares the intended write target and rejects
 * violating messages with a structured `server.store.scope-violation` error.
 *
 * - `any` (default): no guard — back-compat with existing configs.
 * - `broadcast-only`: messages WITH a clientId are rejected.
 * - `client-only`: messages WITHOUT a clientId are rejected.
 *
 * The guard fires BEFORE applyStoreOperation (after normalisation and P80 schema
 * validation). Pass-through for unrelated messages is unchanged.
 */

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<
            string,
            {
                mapConfig: (config: Record<string, unknown>) => unknown;
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

const APP_ID = "testApp110";

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({
        id: APP_ID,
        root: APP_ID,
        name: "Test App",
        layout: "app"
    });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def as Record<string, unknown> });
}

function makeStoreNode(id: string, statePath: string, scope?: string) {
    const config: Record<string, unknown> = { id, parent: APP_ID, statePath };
    if (scope !== undefined) { config.scope = scope; }
    const def = runtimeNodeRegistry["ui-store"].mapConfig(config);
    return {
        id,
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(msg: string) { this.errors.push(msg); },
        warn(msg: string) { this.warns.push(msg); }
    };
}

/** A valid replace message for the given storeId, optionally with clientId. */
function replaceMsg(storeId: string, clientId?: string) {
    const msg: Record<string, unknown> = {
        ui: { store: { id: storeId, op: "replace", value: { x: 1 } } }
    };
    if (clientId !== undefined) {
        (msg.ui as Record<string, unknown>).clientId = clientId;
    }
    return msg;
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    runtimeState.RED = { log: { error: vi.fn(), warn: vi.fn() } };
});

// ---------------------------------------------------------------------------
// scope: "any" (default) — no guard, both message kinds pass through
// ---------------------------------------------------------------------------

describe("P110: scope=any (default) — no guard", () => {
    it("store without scope field accepts a broadcast message (no clientId)", () => {
        registerApp();
        const node = makeStoreNode("storeA1", "data"); // no scope → defaults to "any"
        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeA1"), send, done
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });

    it("store without scope field accepts a per-client message (with clientId)", () => {
        registerApp();
        const node = makeStoreNode("storeA2", "data");
        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeA2", "client42"), send, done
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });

    it("store with explicit scope=any accepts a broadcast message", () => {
        registerApp();
        const node = makeStoreNode("storeA3", "data", "any");
        const send = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeA3"), send, vi.fn()
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });

    it("store with explicit scope=any accepts a per-client message", () => {
        registerApp();
        const node = makeStoreNode("storeA4", "data", "any");
        const send = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeA4", "client1"), send, vi.fn()
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// scope: "broadcast-only" — rejects messages with a clientId
// ---------------------------------------------------------------------------

describe("P110: scope=broadcast-only guard", () => {
    it("broadcast-only store rejects message WITH clientId → server.store.scope-violation, not applied", () => {
        registerApp();
        const node = makeStoreNode("storeB1", "shared", "broadcast-only");
        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeB1", "client99"), send, done
        );

        expect(send).not.toHaveBeenCalled();
        const errors = node.errors.join("\n");
        expect(errors).toContain("server.store.scope-violation");
        expect(errors).toContain("Broadcast");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("broadcast-only store accepts message WITHOUT clientId → passes through normally", () => {
        registerApp();
        const node = makeStoreNode("storeB2", "shared", "broadcast-only");
        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeB2"), send, done
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// scope: "client-only" — rejects messages without a clientId
// ---------------------------------------------------------------------------

describe("P110: scope=client-only guard", () => {
    it("client-only store rejects message WITHOUT clientId → server.store.scope-violation, not applied", () => {
        registerApp();
        const node = makeStoreNode("storeC1", "perUser", "client-only");
        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeC1"), send, done
        );

        expect(send).not.toHaveBeenCalled();
        const errors = node.errors.join("\n");
        expect(errors).toContain("server.store.scope-violation");
        expect(errors).toContain("Client Only");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("client-only store accepts message WITH clientId → passes through normally", () => {
        registerApp();
        const node = makeStoreNode("storeC2", "perUser", "client-only");
        const send = vi.fn();
        const done = vi.fn();

        runtimeNodeRegistry["ui-store"].options.inputHandler(
            node, replaceMsg("storeC2", "clientABC"), send, done
        );

        expect(node.errors).toHaveLength(0);
        expect(send).toHaveBeenCalledOnce();
    });
});

// ---------------------------------------------------------------------------
// scope guard does NOT fire for pass-through (unrelated) messages
// ---------------------------------------------------------------------------

describe("P110: scope guard does not affect pass-through messages", () => {
    it("broadcast-only store passes through message for a different store id unchanged", () => {
        registerApp();
        const node = makeStoreNode("storeD1", "shared", "broadcast-only");
        const send = vi.fn();

        const msg = { ui: { store: { id: "other", op: "replace", value: 1 } } };
        runtimeNodeRegistry["ui-store"].options.inputHandler(node, msg, send, vi.fn());

        expect(send).toHaveBeenCalledWith(msg);
        expect(node.errors).toHaveLength(0);
    });

    it("client-only store passes through message without ui.store", () => {
        registerApp();
        const node = makeStoreNode("storeD2", "perUser", "client-only");
        const send = vi.fn();

        const msg = { payload: "unrelated" };
        runtimeNodeRegistry["ui-store"].options.inputHandler(node, msg, send, vi.fn());

        expect(send).toHaveBeenCalledWith(msg);
        expect(node.errors).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// mapConfig: scope field is preserved in the definition
// ---------------------------------------------------------------------------

describe("P110: mapConfig — scope field round-trip", () => {
    it("mapConfig preserves scope=broadcast-only", () => {
        const def = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "s1",
            parent: APP_ID,
            statePath: "data",
            scope: "broadcast-only"
        }) as Record<string, unknown>;
        expect(def.scope).toBe("broadcast-only");
    });

    it("mapConfig preserves scope=client-only", () => {
        const def = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "s2",
            parent: APP_ID,
            statePath: "data",
            scope: "client-only"
        }) as Record<string, unknown>;
        expect(def.scope).toBe("client-only");
    });

    it("mapConfig defaults scope to any (undefined → any OR omitted)", () => {
        const def = runtimeNodeRegistry["ui-store"].mapConfig({
            id: "s3",
            parent: APP_ID,
            statePath: "data"
        }) as Record<string, unknown>;
        // either undefined (no field) or "any" are both valid for the default
        expect(def.scope === undefined || def.scope === "any").toBe(true);
    });
});
