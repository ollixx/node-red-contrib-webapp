import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * P211 (ADR 0029) — ui-store-action: typed, reference-based store MUTATION.
 *
 * Two modes (mirror ui-action.targetMode):
 *   - reference: apply the op DIRECTLY, server-side, to the referenced store
 *     (per-client via msg.ui.clientId, same scope rule as writing) and emit the
 *     `changed` notification. The live/per-client state is mutated in place.
 *   - wire: do NOT mutate; emit msg.ui.store = { id, op, path, value } for the
 *     flow to wire to the ui-store.
 *
 * Value comes from msg.payload (set/patch/replace); `reset` ignores it. Path
 * precedence: msg.ui.store.path › msg.path › config path › whole slice.
 *
 * These tests exercise op-semantics, path precedence, both modes and the scope
 * rule against the REAL runtime handler — never DOM-presence.
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

const APP_ID = "testApp211";
const STORE_ID = "store211";

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({
        id: APP_ID, root: APP_ID, name: "Test App", layout: "app"
    });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def });
}

function registerStore(statePath: string, initialValue?: string, scope?: string) {
    const config: Record<string, unknown> = { id: STORE_ID, parent: APP_ID, statePath };
    if (initialValue !== undefined) { config.initialValue = initialValue; }
    if (scope !== undefined) { config.scope = scope; }
    const def = runtimeNodeRegistry["ui-store"].mapConfig(config);
    runtimeState.definitions.set(STORE_ID, { nodeId: STORE_ID, appId: APP_ID, definition: def });
    return def;
}

function makeActionNode(overrides: Record<string, unknown> = {}) {
    const config: Record<string, unknown> = { id: "act211", parent: APP_ID, store: STORE_ID, ...overrides };
    const def = runtimeNodeRegistry["ui-store-action"].mapConfig(config);
    return {
        id: "act211",
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(m: string) { this.errors.push(m); },
        warn(m: string) { this.warns.push(m); }
    };
}

const action = () => runtimeNodeRegistry["ui-store-action"];

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    // No RED → the handler skips pushSnapshotToClients but still mutates state.
    runtimeState.RED = undefined;
});

// ---------------------------------------------------------------------------
// mapConfig round-trip
// ---------------------------------------------------------------------------

describe("P211: ui-store-action mapConfig", () => {
    it("defaults op=set, mode=reference; blank path → undefined", () => {
        const def = runtimeNodeRegistry["ui-store-action"].mapConfig({
            id: "a1", parent: APP_ID, store: STORE_ID, path: ""
        });
        expect(def).toMatchObject({ type: "ui-store-action", id: "a1", parent: APP_ID, store: STORE_ID, op: "set", mode: "reference" });
        expect(def.path).toBeUndefined();
    });

    it("carries op, mode and a non-blank path", () => {
        const def = runtimeNodeRegistry["ui-store-action"].mapConfig({
            id: "a2", parent: APP_ID, store: STORE_ID, op: "patch", mode: "wire", path: "name"
        });
        expect(def).toMatchObject({ op: "patch", mode: "wire", path: "name" });
    });

    it("an unknown mode falls back to reference", () => {
        const def = runtimeNodeRegistry["ui-store-action"].mapConfig({
            id: "a3", parent: APP_ID, store: STORE_ID, mode: "bogus"
        });
        expect(def.mode).toBe("reference");
    });
});

// ---------------------------------------------------------------------------
// wire mode — emits the command envelope, NEVER mutates
// ---------------------------------------------------------------------------

describe("P211: wire mode emits { id, op, path, value } and does not mutate", () => {
    beforeEach(() => {
        registerApp();
        registerStore("entity", '{"name":"A","city":"X"}');
        runtimeState.liveState.set(APP_ID, { entity: { name: "A", city: "X" } });
    });

    it("emits the envelope with value from payload and config path", () => {
        const node = makeActionNode({ op: "set", mode: "wire", path: "name" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: "Z", ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { store: Record<string, unknown> } };
        expect(out.ui.store).toEqual({ id: STORE_ID, op: "set", path: "name", value: "Z" });
        // no mutation
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A", city: "X" } });
    });

    it("reset in wire mode carries no value (undefined)", () => {
        const node = makeActionNode({ op: "reset", mode: "wire" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: "ignored", ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { store: Record<string, unknown> } };
        expect(out.ui.store).toMatchObject({ id: STORE_ID, op: "reset" });
        expect(out.ui.store.value).toBeUndefined();
    });

    it("path precedence: msg.ui.store.path wins in the emitted envelope", () => {
        const node = makeActionNode({ op: "set", mode: "wire", path: "city" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: "Q", path: "name", ui: { store: { path: "zip" } } }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { store: Record<string, unknown> } };
        expect(out.ui.store.path).toBe("zip");
    });
});

// ---------------------------------------------------------------------------
// reference mode — op-semantics against the real applyStoreOperation
// ---------------------------------------------------------------------------

describe("P211: reference mode op-semantics (broadcast)", () => {
    beforeEach(() => {
        registerApp();
        registerStore("entity", '{"name":"A","city":"X"}');
        runtimeState.liveState.set(APP_ID, { entity: { name: "A", city: "X" } });
    });

    it("set at path mutates that sub-value and emits a changed notification", () => {
        const node = makeActionNode({ op: "set", path: "name" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: "B", ui: {} }, send, vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "B", city: "X" } });
        const out = send.mock.calls[0][0] as { ui: { store: Record<string, unknown> } };
        expect(out.ui.store).toMatchObject({ id: STORE_ID, event: "changed", op: "set", path: "name", value: "B" });
    });

    it("patch deep-merges at path", () => {
        const node = makeActionNode({ op: "patch", path: "" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { city: "Y" }, ui: {} }, send, vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A", city: "Y" } });
    });

    it("replace swaps the WHOLE slice regardless of path", () => {
        const node = makeActionNode({ op: "replace", path: "name" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { fresh: true }, ui: {} }, send, vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { fresh: true } });
    });

    it("delete removes the sub-value at path", () => {
        const node = makeActionNode({ op: "delete", path: "city" });
        const send = vi.fn();
        action().options.inputHandler(node, { ui: {} }, send, vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A" } });
    });

    it("reset restores the store initialValue and IGNORES the payload", () => {
        runtimeState.liveState.set(APP_ID, { entity: { name: "mutated", city: "elsewhere", extra: 1 } });
        const node = makeActionNode({ op: "reset" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { should: "be ignored" }, ui: {} }, send, vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A", city: "X" } });
    });
});

// ---------------------------------------------------------------------------
// reference mode — path precedence
// ---------------------------------------------------------------------------

describe("P211: reference mode path precedence", () => {
    beforeEach(() => {
        registerApp();
        registerStore("entity", '{"name":"A","city":"X"}');
        runtimeState.liveState.set(APP_ID, { entity: { name: "A", city: "X" } });
    });

    it("config path is used when no msg override", () => {
        const node = makeActionNode({ op: "set", path: "city" });
        action().options.inputHandler(node, { payload: "CFG", ui: {} }, vi.fn(), vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A", city: "CFG" } });
    });

    it("msg.path overrides config path", () => {
        const node = makeActionNode({ op: "set", path: "city" });
        action().options.inputHandler(node, { payload: "MP", path: "name", ui: {} }, vi.fn(), vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "MP", city: "X" } });
    });

    it("msg.ui.store.path wins over msg.path and config", () => {
        const node = makeActionNode({ op: "set", path: "city" });
        action().options.inputHandler(node, { payload: "TOP", path: "name", ui: { store: { path: "city" } } }, vi.fn(), vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A", city: "TOP" } });
    });

    it("empty path (root) — set writes the whole slice", () => {
        const node = makeActionNode({ op: "set", path: "" });
        action().options.inputHandler(node, { payload: { only: "this" }, ui: {} }, vi.fn(), vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { only: "this" } });
    });
});

// ---------------------------------------------------------------------------
// reference mode — per-client + scope rule
// ---------------------------------------------------------------------------

describe("P211: reference mode per-client + scope rule", () => {
    it("client-only op with clientId mutates only that client's slice, not broadcast", () => {
        registerApp();
        registerStore("entity", '{"name":"A","city":"X"}', "client-only");
        runtimeState.liveState.set(APP_ID, { entity: { name: "A", city: "X" } });

        const node = makeActionNode({ op: "set", path: "name" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: "B", ui: { clientId: "c1" } }, send, vi.fn());

        // per-client slice mutated
        const client = runtimeState.clientStateMap.get(APP_ID)?.get("c1");
        expect((client?.state as { entity: { name: string } }).entity.name).toBe("B");
        // broadcast untouched
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A", city: "X" } });
        const out = send.mock.calls[0][0] as { ui: { store: Record<string, unknown> } };
        expect(out.ui.store).toMatchObject({ clientId: "c1", value: "B" });
    });

    it("client-only op WITHOUT clientId → server.store.scope-violation, no mutation, no send", () => {
        registerApp();
        registerStore("entity", '{"name":"A"}', "client-only");
        runtimeState.liveState.set(APP_ID, { entity: { name: "A" } });

        const node = makeActionNode({ op: "set", path: "name" });
        const send = vi.fn();
        const done = vi.fn();
        action().options.inputHandler(node, { payload: "B", ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.scope-violation");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A" } });
    });

    it("broadcast-only op WITH clientId → scope-violation", () => {
        registerApp();
        registerStore("shared", '{"n":1}', "broadcast-only");
        runtimeState.liveState.set(APP_ID, { shared: { n: 1 } });

        const node = makeActionNode({ op: "patch", path: "" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { n: 2 }, ui: { clientId: "c9" } }, send, vi.fn());

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.scope-violation");
    });
});

// ---------------------------------------------------------------------------
// reference mode — validation errors
// ---------------------------------------------------------------------------

describe("P211: reference mode validation", () => {
    it("unknown referenced store → server.store.action-missing-store, no send", () => {
        registerApp();
        // no store registered
        const node = makeActionNode({ op: "set", path: "name" });
        const send = vi.fn();
        const done = vi.fn();
        action().options.inputHandler(node, { payload: "B", ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.action-missing-store");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("set without a payload value → server.store.invalid-operation, no mutation", () => {
        registerApp();
        registerStore("entity", '{"name":"A"}');
        runtimeState.liveState.set(APP_ID, { entity: { name: "A" } });

        const node = makeActionNode({ op: "set", path: "name" });
        const send = vi.fn();
        const done = vi.fn();
        action().options.inputHandler(node, { ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.store.invalid-operation");
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A" } });
    });

    it("delete does NOT require a payload value", () => {
        registerApp();
        registerStore("entity", '{"name":"A","city":"X"}');
        runtimeState.liveState.set(APP_ID, { entity: { name: "A", city: "X" } });

        const node = makeActionNode({ op: "delete", path: "city" });
        const send = vi.fn();
        action().options.inputHandler(node, { ui: {} }, send, vi.fn());

        expect(send).toHaveBeenCalled();
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A" } });
    });
});
