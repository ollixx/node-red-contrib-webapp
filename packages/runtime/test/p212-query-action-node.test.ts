import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * P212 (ADR 0029) — ui-query-action: typed, reference-based query TRIGGER.
 *
 * Two modes (mirror ui-action.targetMode):
 *   - reference: fire the referenced query's refresh DIRECTLY (fireQueryRefresh)
 *     so the ui-query's out-port emits its retrieval. No wire.
 *   - wire: do NOT trigger; emit msg.ui.query = { queryPath, refresh:true, params }
 *     for the flow to wire to the ui-query.
 *
 * Params come from msg.ui.query.params › msg.payload; absent → the params key is
 * OMITTED. These tests exercise both modes, the params source/omission rule and
 * the missing-query error against the REAL runtime handler — never DOM-presence.
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

const APP_ID = "testApp212";
const QUERY_ID = "query212";
const QUERY_NODE_ID = "queryNode212"; // distinct from QUERY_ID to prove nodeId resolution
const QUERY_PATH = "customers";

// A fake ui-query runtime node with a `send` spy so reference mode can be proven
// by the retrieval envelope the query emits on its out-port.
let queryNodeSend: ReturnType<typeof vi.fn>;

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({
        id: APP_ID, root: APP_ID, name: "Test App", layout: "app"
    });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def });
}

function registerQuery(queryPath: string = QUERY_PATH) {
    const def = runtimeNodeRegistry["ui-query"].mapConfig({
        id: QUERY_ID, parent: APP_ID, queryPath
    });
    runtimeState.definitions.set(QUERY_NODE_ID, { nodeId: QUERY_NODE_ID, appId: APP_ID, definition: def });
    return def;
}

function installRED() {
    queryNodeSend = vi.fn();
    runtimeState.RED = {
        nodes: {
            getNode(id: string) {
                if (id === QUERY_NODE_ID) {
                    return { id: QUERY_NODE_ID, send: queryNodeSend };
                }
                return null;
            }
        }
    };
}

function makeActionNode(overrides: Record<string, unknown> = {}) {
    const config: Record<string, unknown> = { id: "qact212", parent: APP_ID, query: QUERY_ID, ...overrides };
    const def = runtimeNodeRegistry["ui-query-action"].mapConfig(config);
    return {
        id: "qact212",
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(m: string) { this.errors.push(m); },
        warn(m: string) { this.warns.push(m); }
    };
}

const action = () => runtimeNodeRegistry["ui-query-action"];

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    runtimeState.RED = undefined;
});

// ---------------------------------------------------------------------------
// mapConfig round-trip
// ---------------------------------------------------------------------------

describe("P212: ui-query-action mapConfig", () => {
    it("defaults action=refresh, mode=reference", () => {
        const def = runtimeNodeRegistry["ui-query-action"].mapConfig({
            id: "q1", parent: APP_ID, query: QUERY_ID
        });
        expect(def).toMatchObject({
            type: "ui-query-action", id: "q1", parent: APP_ID, query: QUERY_ID, action: "refresh", mode: "reference"
        });
    });

    it("carries action and mode", () => {
        const def = runtimeNodeRegistry["ui-query-action"].mapConfig({
            id: "q2", parent: APP_ID, query: QUERY_ID, action: "refresh", mode: "wire"
        });
        expect(def).toMatchObject({ action: "refresh", mode: "wire" });
    });

    it("an unknown mode falls back to reference", () => {
        const def = runtimeNodeRegistry["ui-query-action"].mapConfig({
            id: "q3", parent: APP_ID, query: QUERY_ID, mode: "bogus"
        });
        expect(def.mode).toBe("reference");
    });
});

// ---------------------------------------------------------------------------
// wire mode — emits { queryPath, refresh:true, params }, does NOT trigger
// ---------------------------------------------------------------------------

describe("P212: wire mode emits the refresh envelope and does not trigger", () => {
    beforeEach(() => {
        registerApp();
        registerQuery();
        installRED();
    });

    it("emits { queryPath, refresh:true, params } with params from payload", () => {
        const node = makeActionNode({ mode: "wire" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { page: 2 }, ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(out.ui.query).toEqual({ queryPath: QUERY_PATH, refresh: true, params: { page: 2 } });
        // wire mode never triggers the query directly
        expect(queryNodeSend).not.toHaveBeenCalled();
    });

    it("omits the params key when neither payload nor msg.ui.query.params is present", () => {
        const node = makeActionNode({ mode: "wire" });
        const send = vi.fn();
        action().options.inputHandler(node, { ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(out.ui.query).toEqual({ queryPath: QUERY_PATH, refresh: true });
        expect("params" in out.ui.query).toBe(false);
    });

    it("msg.ui.query.params wins over msg.payload in the emitted envelope", () => {
        const node = makeActionNode({ mode: "wire" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { page: 9 }, ui: { query: { params: { page: 1 } } } }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(out.ui.query.params).toEqual({ page: 1 });
    });
});

// ---------------------------------------------------------------------------
// reference mode — fires the referenced query's refresh via its out-port
// ---------------------------------------------------------------------------

describe("P212: reference mode triggers the referenced query directly", () => {
    beforeEach(() => {
        registerApp();
        registerQuery();
        installRED();
    });

    it("fires the query's refresh on its out-port carrying queryPath + params", () => {
        const node = makeActionNode({ mode: "reference" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { search: "ab" }, ui: {} }, send, vi.fn());
        // The referenced query emitted its retrieval envelope on its OWN out-port
        // (resolved via the distinct QUERY_NODE_ID, not QUERY_ID).
        expect(queryNodeSend).toHaveBeenCalledTimes(1);
        const emitted = queryNodeSend.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(emitted.ui.query).toMatchObject({ queryPath: QUERY_PATH, refresh: true, params: { search: "ab" } });
        // The action node itself does not emit anything in reference mode.
        expect(send).not.toHaveBeenCalled();
    });

    it("carries clientId onto the refresh (per-client)", () => {
        const node = makeActionNode({ mode: "reference" });
        action().options.inputHandler(node, { payload: { search: "x" }, ui: { clientId: "c7" } }, vi.fn(), vi.fn());
        const emitted = queryNodeSend.mock.calls[0][0] as { ui: { clientId?: string } };
        expect(emitted.ui.clientId).toBe("c7");
    });

    it("omits params when no payload / no msg.ui.query.params", () => {
        const node = makeActionNode({ mode: "reference" });
        action().options.inputHandler(node, { ui: {} }, vi.fn(), vi.fn());
        const emitted = queryNodeSend.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(emitted.ui.query).toEqual({ queryPath: QUERY_PATH, refresh: true });
        expect("params" in emitted.ui.query).toBe(false);
    });

    it("msg.ui.query.params takes precedence over msg.payload", () => {
        const node = makeActionNode({ mode: "reference" });
        action().options.inputHandler(node, { payload: { p: 9 }, ui: { query: { params: { p: 1 } } } }, vi.fn(), vi.fn());
        const emitted = queryNodeSend.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(emitted.ui.query.params).toEqual({ p: 1 });
    });
});

// ---------------------------------------------------------------------------
// validation — the referenced query must exist
// ---------------------------------------------------------------------------

describe("P212: missing query reference", () => {
    it("unknown referenced query → server.query.action-missing-query, no send, done(error) [reference]", () => {
        registerApp();
        installRED();
        // no ui-query registered
        const node = makeActionNode({ mode: "reference" });
        const send = vi.fn();
        const done = vi.fn();
        action().options.inputHandler(node, { payload: {}, ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.query.action-missing-query");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });

    it("unknown referenced query → error in wire mode too (queryPath cannot be resolved)", () => {
        registerApp();
        installRED();
        const node = makeActionNode({ mode: "wire" });
        const send = vi.fn();
        const done = vi.fn();
        action().options.inputHandler(node, { payload: {}, ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.query.action-missing-query");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
    });
});
