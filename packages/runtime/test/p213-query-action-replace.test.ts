import { createRequire } from "node:module";

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * P213 (ADR 0029) — ui-query-action action `replace`: the DATA-IN side of
 * `refresh`. `msg.payload` becomes the referenced query's data.
 *
 *   - reference: write ui.queries.<queryPath>.data DIRECTLY (per-client via
 *     msg.ui.clientId, else the broadcast state), with an SSE re-render. The node
 *     itself does NOT emit. Reuses applyQueryMessage (the P160 fold).
 *   - wire: do NOT mutate; emit msg.ui.query = { queryPath, data, totalCount?,
 *     pageCount? } for the flow to wire to the ui-query input.
 *
 * No payload (undefined/null) → data is [] (an explicit replace-to-empty).
 * These tests exercise both modes + the refresh regression against the REAL
 * runtime handler and assert on the effect (state / envelope), never DOM presence.
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
            liveState: Map<string, Record<string, unknown>>;
            clientStateMap: Map<string, Map<string, { state: Record<string, unknown>; timestamp: number }>>;
            definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
            streamClients: Map<string, unknown>;
            RED: unknown;
        };
    };
};

const { runtimeNodeRegistry, runtimeState } = webapp.__test__;

const APP_ID = "testApp213";
const QUERY_ID = "query213";
const QUERY_NODE_ID = "queryNode213"; // distinct from QUERY_ID to prove nodeId resolution
const QUERY_PATH = "customers";

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
        // settings drive readDeployDefinitions → a non-existent flow file yields []
        // (deterministic; the query envelope is still written via applyQueryMessage).
        settings: { userDir: "/nonexistent-p213", flowFile: "flows.json" },
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
    const config: Record<string, unknown> = { id: "qact213", parent: APP_ID, query: QUERY_ID, ...overrides };
    const def = runtimeNodeRegistry["ui-query-action"].mapConfig(config);
    return {
        id: "qact213",
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(m: string) { this.errors.push(m); },
        warn(m: string) { this.warns.push(m); }
    };
}

const action = () => runtimeNodeRegistry["ui-query-action"];

function queryEnvelopeFrom(state: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    const ui = state?.ui as Record<string, unknown> | undefined;
    const queries = ui?.queries as Record<string, unknown> | undefined;
    return queries?.[QUERY_PATH] as Record<string, unknown> | undefined;
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    runtimeState.RED = undefined;
});

// ---------------------------------------------------------------------------
// mapConfig — action=replace round-trips
// ---------------------------------------------------------------------------

describe("P213: ui-query-action mapConfig carries action=replace", () => {
    it("carries action=replace", () => {
        const def = runtimeNodeRegistry["ui-query-action"].mapConfig({
            id: "q1", parent: APP_ID, query: QUERY_ID, action: "replace", mode: "reference"
        });
        expect(def).toMatchObject({ action: "replace", mode: "reference" });
    });
});

// ---------------------------------------------------------------------------
// reference mode — writes ui.queries.<path>.data DIRECTLY, does NOT emit
// ---------------------------------------------------------------------------

describe("P213: reference + replace writes the query data directly", () => {
    beforeEach(() => {
        registerApp();
        registerQuery();
        installRED();
    });

    it("sets the broadcast query data from payload, status success; node emits nothing", () => {
        const node = makeActionNode({ action: "replace", mode: "reference" });
        const send = vi.fn();
        const rows = [{ id: 1, name: "Ada" }, { id: 2, name: "Alan" }];
        action().options.inputHandler(node, { payload: rows, ui: {} }, send, vi.fn());

        const envelope = queryEnvelopeFrom(runtimeState.liveState.get(APP_ID));
        expect(envelope?.data).toEqual(rows);
        expect(envelope?.status).toBe("success");
        // reference mode never emits on the action node's own out-port
        expect(send).not.toHaveBeenCalled();
        // and it does NOT trigger the referenced query (that is refresh, not replace)
        expect(queryNodeSend).not.toHaveBeenCalled();
    });

    it("writes to the per-client state when msg.ui.clientId is set (not the broadcast)", () => {
        const node = makeActionNode({ action: "replace", mode: "reference" });
        const rows = [{ id: 7 }];
        action().options.inputHandler(node, { payload: rows, ui: { clientId: "c9" } }, vi.fn(), vi.fn());

        const clientState = runtimeState.clientStateMap.get(APP_ID)?.get("c9")?.state;
        expect(queryEnvelopeFrom(clientState)?.data).toEqual(rows);
        // the broadcast state is untouched
        expect(runtimeState.liveState.get(APP_ID)).toBeUndefined();
    });

    it("carries totalCount / pageCount from msg.ui.query.* onto the envelope", () => {
        const node = makeActionNode({ action: "replace", mode: "reference" });
        const rows = [{ id: 1 }];
        action().options.inputHandler(
            node,
            { payload: rows, ui: { query: { totalCount: 42, pageCount: 5 } } },
            vi.fn(),
            vi.fn()
        );
        const envelope = queryEnvelopeFrom(runtimeState.liveState.get(APP_ID));
        expect(envelope?.data).toEqual(rows);
        expect(envelope?.totalCount).toBe(42);
        expect(envelope?.pageCount).toBe(5);
    });

    it("no payload → replaces with an empty list ([])", () => {
        const node = makeActionNode({ action: "replace", mode: "reference" });
        action().options.inputHandler(node, { ui: {} }, vi.fn(), vi.fn());
        const envelope = queryEnvelopeFrom(runtimeState.liveState.get(APP_ID));
        expect(envelope?.data).toEqual([]);
        expect(envelope?.status).toBe("success");
    });
});

// ---------------------------------------------------------------------------
// wire mode — emits { queryPath, data }, does NOT mutate
// ---------------------------------------------------------------------------

describe("P213: wire + replace emits the data envelope and does not mutate", () => {
    beforeEach(() => {
        registerApp();
        registerQuery();
        installRED();
    });

    it("emits { queryPath, data } from payload and leaves the state untouched", () => {
        const node = makeActionNode({ action: "replace", mode: "wire" });
        const send = vi.fn();
        const rows = [{ id: 1, name: "Grace" }];
        action().options.inputHandler(node, { payload: rows, ui: {} }, send, vi.fn());

        const out = send.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(out.ui.query).toEqual({ queryPath: QUERY_PATH, data: rows });
        // wire mode does NOT write query state
        expect(runtimeState.liveState.get(APP_ID)).toBeUndefined();
        expect(runtimeState.clientStateMap.get(APP_ID)).toBeUndefined();
    });

    it("passes totalCount / pageCount through into the emitted envelope", () => {
        const node = makeActionNode({ action: "replace", mode: "wire" });
        const send = vi.fn();
        const rows = [{ id: 1 }];
        action().options.inputHandler(
            node,
            { payload: rows, ui: { query: { totalCount: 100, pageCount: 10 } } },
            send,
            vi.fn()
        );
        const out = send.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(out.ui.query).toEqual({ queryPath: QUERY_PATH, data: rows, totalCount: 100, pageCount: 10 });
    });

    it("no payload → emits data: []", () => {
        const node = makeActionNode({ action: "replace", mode: "wire" });
        const send = vi.fn();
        action().options.inputHandler(node, { ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(out.ui.query).toEqual({ queryPath: QUERY_PATH, data: [] });
    });
});

// ---------------------------------------------------------------------------
// missing query — replace reports the error (op = query:replace)
// ---------------------------------------------------------------------------

describe("P213: missing query reference under replace", () => {
    it("unknown referenced query → server.query.action-missing-query, no send, done(error)", () => {
        registerApp();
        installRED();
        // no ui-query registered
        const node = makeActionNode({ action: "replace", mode: "reference" });
        const send = vi.fn();
        const done = vi.fn();
        action().options.inputHandler(node, { payload: [{ id: 1 }], ui: {} }, send, done);

        expect(send).not.toHaveBeenCalled();
        expect(node.errors.join("\n")).toContain("server.query.action-missing-query");
        expect(done).toHaveBeenCalledWith(expect.any(Error));
        // nothing written to state
        expect(runtimeState.liveState.get(APP_ID)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// regression — action=refresh still triggers the query (P212 path unchanged)
// ---------------------------------------------------------------------------

describe("P213: action=refresh is unchanged (regression)", () => {
    beforeEach(() => {
        registerApp();
        registerQuery();
        installRED();
    });

    it("reference + refresh still fires the query's refresh on its out-port", () => {
        const node = makeActionNode({ action: "refresh", mode: "reference" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { search: "ab" }, ui: {} }, send, vi.fn());
        expect(queryNodeSend).toHaveBeenCalledTimes(1);
        const emitted = queryNodeSend.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(emitted.ui.query).toMatchObject({ queryPath: QUERY_PATH, refresh: true, params: { search: "ab" } });
        // refresh must NOT write query data
        expect(queryEnvelopeFrom(runtimeState.liveState.get(APP_ID))?.data).toBeUndefined();
        expect(send).not.toHaveBeenCalled();
    });

    it("wire + refresh still emits the refresh envelope (not a data envelope)", () => {
        const node = makeActionNode({ action: "refresh", mode: "wire" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: { page: 2 }, ui: {} }, send, vi.fn());
        const out = send.mock.calls[0][0] as { ui: { query: Record<string, unknown> } };
        expect(out.ui.query).toEqual({ queryPath: QUERY_PATH, refresh: true, params: { page: 2 } });
        expect("data" in out.ui.query).toBe(false);
    });
});
