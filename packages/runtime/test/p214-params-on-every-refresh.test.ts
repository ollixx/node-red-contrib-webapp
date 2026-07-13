import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P214 (ADR 0030) — acceptance „Params bei JEDEM Out-Port-Refresh".
 *
 * Whenever ANYTHING triggers a refresh-emit of a query — an onEnter, a plain
 * refresh message through `queryInputHandler`, or a `ui-query-action` refresh —
 * the query attaches its CURRENT params (from its resolved params store: the
 * implicit `ui.queries.<queryPath>.params` slice when `params` is empty, else the
 * explicit ui-store, for that `clientId`) onto `msg.ui.query.params`. This closes
 * today's gap where a plain refresh reached the datasource WITHOUT params.
 *
 * Kept orthogonal to P175 (data/error terminal): a foreign pass-through is byte-
 * identical, and params a caller already supplied are never clobbered.
 */

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

const {
    runtimeNodeRegistry,
    runtimeState,
    queryInputHandler,
    resolveCurrentQueryParams,
    initializeState
} = t;

const APP_ID = "p214rApp";
const QUERY_ID = "p214rQuery";
const QUERY_NODE_ID = "p214rQueryNode";
const QUERY_PATH = "entities";
const STORE_ID = "p214rStore";

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({ id: APP_ID, root: APP_ID, name: "App", layout: "app" });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def });
}

function registerQuery(overrides: Record<string, unknown> = {}) {
    const def = runtimeNodeRegistry["ui-query"].mapConfig({
        id: QUERY_ID, parent: APP_ID, queryPath: QUERY_PATH, ...overrides
    });
    runtimeState.definitions.set(QUERY_NODE_ID, { nodeId: QUERY_NODE_ID, appId: APP_ID, definition: def });
    return def;
}

function registerStore(statePath: string, initialValue?: string) {
    const config: Record<string, unknown> = { id: STORE_ID, parent: APP_ID, statePath };
    if (initialValue !== undefined) { config.initialValue = initialValue; }
    const def = runtimeNodeRegistry["ui-store"].mapConfig(config);
    runtimeState.definitions.set(STORE_ID, { nodeId: STORE_ID, appId: APP_ID, definition: def });
    return def;
}

// The runtime ui-query node the queryInputHandler receives (webappDefinition set).
function queryNode() {
    return { id: QUERY_NODE_ID, webappDefinition: runtimeState.definitions.get(QUERY_NODE_ID)!.definition };
}

function seedLive(state?: any) {
    runtimeState.liveState.set(APP_ID, state ?? initializeState([], [{ queryPath: QUERY_PATH }], APP_ID));
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    runtimeState.queryEtags.clear();
    runtimeState.RED = {
        nodes: { getNode: () => undefined },
        settings: { flowFile: "/nonexistent/p214r-flows.json", userDir: "/tmp" },
        util: {}
    };
    registerApp();
});

afterEach(() => {
    runtimeState.RED = undefined;
});

// ---------------------------------------------------------------------------
// resolveCurrentQueryParams — implicit slice vs explicit store, per-client
// ---------------------------------------------------------------------------

describe("P214 resolveCurrentQueryParams", () => {
    it("reads the IMPLICIT slice ui.queries.<path>.params (broadcast)", () => {
        const def = registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 2, sort: "name" };
        seedLive(state);
        expect(resolveCurrentQueryParams(def, APP_ID, undefined)).toEqual({ page: 2, sort: "name" });
    });

    it("reads the EXPLICIT store's slice when `params` is set", () => {
        const storeDef = registerStore("filters", '{"page":1}');
        const def = registerQuery({ params: STORE_ID });
        const state: any = initializeState([storeDef], [{ queryPath: QUERY_PATH }], APP_ID);
        state.filters = { page: 4 };
        seedLive(state);
        expect(resolveCurrentQueryParams(def, APP_ID, undefined)).toEqual({ page: 4 });
    });

    it("reads the per-client slice when a clientId is given", () => {
        const def = registerQuery();
        const cstate: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        cstate.ui.queries[QUERY_PATH].params = { page: 9 };
        t.setClientState(APP_ID, "c1", cstate, Date.now());
        seedLive(); // broadcast has no params
        expect(resolveCurrentQueryParams(def, APP_ID, "c1")).toEqual({ page: 9 });
        expect(resolveCurrentQueryParams(def, APP_ID, undefined)).toBeUndefined();
    });

    it("returns undefined when no params exist yet (so callers OMIT the key)", () => {
        const def = registerQuery();
        seedLive();
        expect(resolveCurrentQueryParams(def, APP_ID, undefined)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// queryInputHandler — plain refresh + onEnter carry current params
// ---------------------------------------------------------------------------

describe("P214 queryInputHandler enriches out-port triggers with current params", () => {
    it("a PLAIN refresh (no params in the message) carries the CURRENT implicit params", () => {
        registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 3 };
        seedLive(state);

        const send = vi.fn();
        queryInputHandler(queryNode(), { ui: { query: { queryPath: QUERY_PATH, refresh: true } } }, send, vi.fn());
        expect(send).toHaveBeenCalledTimes(1);
        const out = send.mock.calls[0][0];
        expect(out.ui.query).toMatchObject({ queryPath: QUERY_PATH, refresh: true, params: { page: 3 } });
    });

    it("an onEnter lifecycle (no msg.ui.query) gets a query envelope with current params", () => {
        registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 5 };
        seedLive(state);

        const send = vi.fn();
        queryInputHandler(queryNode(), { ui: { event: "onEnter", clientId: undefined } }, send, vi.fn());
        const out = send.mock.calls[0][0];
        expect(out.ui.query).toEqual({ queryPath: QUERY_PATH, params: { page: 5 } });
        // onEnter is preserved.
        expect(out.ui.event).toBe("onEnter");
    });

    it("the EXPLICIT params store is honoured too (today's gap): plain refresh carries it", () => {
        registerStore("filters", "{}");
        registerQuery({ params: STORE_ID });
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.filters = { page: 7, sort: "z" };
        seedLive(state);

        const send = vi.fn();
        queryInputHandler(queryNode(), { ui: { query: { queryPath: QUERY_PATH, refresh: true } } }, send, vi.fn());
        expect(send.mock.calls[0][0].ui.query.params).toEqual({ page: 7, sort: "z" });
    });

    it("does NOT clobber params the caller already put on the message", () => {
        registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 3 };
        seedLive(state);

        const send = vi.fn();
        queryInputHandler(queryNode(), { ui: { query: { queryPath: QUERY_PATH, refresh: true, params: { page: 99 } } } }, send, vi.fn());
        expect(send.mock.calls[0][0].ui.query.params).toEqual({ page: 99 });
    });

    it("a FOREIGN message (no msg.ui.query, not onEnter) passes through UNCHANGED (same ref)", () => {
        registerQuery();
        seedLive();
        const send = vi.fn();
        const msg = { payload: "hello", topic: "foreign" };
        queryInputHandler(queryNode(), msg, send, vi.fn());
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBe(msg);
    });

    it("when NO params exist, a plain refresh is emitted WITHOUT a params key", () => {
        registerQuery();
        seedLive();
        const send = vi.fn();
        queryInputHandler(queryNode(), { ui: { query: { queryPath: QUERY_PATH, refresh: true } } }, send, vi.fn());
        const out = send.mock.calls[0][0];
        expect("params" in out.ui.query).toBe(false);
    });

    it("per-client: a plain refresh with clientId carries THAT client's params", () => {
        registerQuery();
        const cstate: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        cstate.ui.queries[QUERY_PATH].params = { page: 8 };
        t.setClientState(APP_ID, "c2", cstate, Date.now());
        seedLive(); // broadcast: no params

        const send = vi.fn();
        queryInputHandler(queryNode(), { ui: { query: { queryPath: QUERY_PATH, refresh: true }, clientId: "c2" } }, send, vi.fn());
        expect(send.mock.calls[0][0].ui.query.params).toEqual({ page: 8 });
    });
});

// ---------------------------------------------------------------------------
// ui-query-action refresh — carries current params when the message supplied none
// ---------------------------------------------------------------------------

describe("P214 ui-query-action refresh carries current params", () => {
    let queryNodeSend: ReturnType<typeof vi.fn>;

    function installQueryNodeRED() {
        queryNodeSend = vi.fn();
        runtimeState.RED = {
            nodes: { getNode: (id: string) => (id === QUERY_NODE_ID ? { id: QUERY_NODE_ID, send: queryNodeSend } : null) },
            settings: { flowFile: "/nonexistent/p214r-flows.json", userDir: "/tmp" },
            util: {}
        };
    }

    function makeActionNode(overrides: Record<string, unknown> = {}) {
        const def = runtimeNodeRegistry["ui-query-action"].mapConfig({
            id: "qa214r", parent: APP_ID, query: QUERY_ID, action: "refresh", ...overrides
        });
        return { id: "qa214r", webappDefinition: def, errors: [] as string[], error(m: string) { this.errors.push(m); }, warn() {} };
    }

    it("reference mode: no payload → the query's out-port refresh carries the CURRENT implicit params", () => {
        registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 2 };
        seedLive(state);
        installQueryNodeRED();

        runtimeNodeRegistry["ui-query-action"].options.inputHandler(makeActionNode({ mode: "reference" }), { ui: {} }, vi.fn(), vi.fn());
        expect(queryNodeSend).toHaveBeenCalledTimes(1);
        expect(queryNodeSend.mock.calls[0][0].ui.query.params).toEqual({ page: 2 });
    });

    it("wire mode: no payload → the emitted envelope carries the CURRENT implicit params", () => {
        registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 6 };
        seedLive(state);
        installQueryNodeRED();

        const send = vi.fn();
        runtimeNodeRegistry["ui-query-action"].options.inputHandler(makeActionNode({ mode: "wire" }), { ui: {} }, send, vi.fn());
        expect(send.mock.calls[0][0].ui.query).toMatchObject({ queryPath: QUERY_PATH, refresh: true, params: { page: 6 } });
    });

    it("an explicit payload still WINS over the stored params", () => {
        registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 2 };
        seedLive(state);
        installQueryNodeRED();

        runtimeNodeRegistry["ui-query-action"].options.inputHandler(makeActionNode({ mode: "reference" }), { payload: { page: 42 }, ui: {} }, vi.fn(), vi.fn());
        expect(queryNodeSend.mock.calls[0][0].ui.query.params).toEqual({ page: 42 });
    });

    it("no stored params AND no payload → params key stays omitted (P212 contract preserved)", () => {
        registerQuery();
        seedLive();
        installQueryNodeRED();

        runtimeNodeRegistry["ui-query-action"].options.inputHandler(makeActionNode({ mode: "reference" }), { ui: {} }, vi.fn(), vi.fn());
        const emitted = queryNodeSend.mock.calls[0][0];
        expect("params" in emitted.ui.query).toBe(false);
    });
});
