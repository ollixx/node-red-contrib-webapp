import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P161 — ui-query reactive paging loop (ADR 0016 §3).
 *
 * Two server-side pieces, unit-tested here:
 *   1. paging metadata storage: `applyQueryMessage` folds `totalCount`/`pageCount`
 *      into the live envelope alongside `data`, and `buildQuerySources` surfaces
 *      them in the lifecycle map so `query:<path>.totalCount` resolves;
 *   2. out-port refresh on params change: `triggerParamQueryRefresh` flips the
 *      observing query's lifecycle to `loading` and emits a refresh on its
 *      OUT-PORT carrying the store's current value as `msg.ui.query.params` — and
 *      does NOT mutate the data (so the loop closes only via the wired in-port).
 */

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

const { applyQueryMessage, buildQuerySources, initializeState, triggerParamQueryRefresh } = t;

const APP_ID = "pagingApp";
const STORE_ID = "paramsStore";
const QUERY_ID = "listQuery";
const QUERY_PATH = "list";

const QUERIES = [{ queryPath: QUERY_PATH }];

describe("P161 paging metadata storage", () => {
    it("a data push folds totalCount + pageCount into the envelope", () => {
        const seed = initializeState([], QUERIES, APP_ID);
        const next = applyQueryMessage(seed, {
            queryPath: QUERY_PATH,
            data: [{ id: "c1" }],
            totalCount: 42,
            pageCount: 5
        });
        const env = next.ui.queries.list;
        expect(env.data).toEqual([{ id: "c1" }]);
        expect(env.totalCount).toBe(42);
        expect(env.pageCount).toBe(5);
        expect(env.status).toBe("success");
    });

    it("a later data-only push keeps the last known totalCount", () => {
        let state = initializeState([], QUERIES, APP_ID);
        state = applyQueryMessage(state, { queryPath: QUERY_PATH, data: [{ id: "c1" }], totalCount: 42 });
        state = applyQueryMessage(state, { queryPath: QUERY_PATH, data: [{ id: "c2" }] });
        expect(state.ui.queries.list.totalCount).toBe(42);
        expect(state.ui.queries.list.data).toEqual([{ id: "c2" }]);
    });

    it("buildQuerySources surfaces totalCount/pageCount in the lifecycle map", () => {
        let state = initializeState([], QUERIES, APP_ID);
        state = applyQueryMessage(state, { queryPath: QUERY_PATH, data: [{ id: "c1" }], totalCount: 42, pageCount: 5 });
        const { queryLifecycle } = buildQuerySources(state, QUERIES);
        expect(queryLifecycle[QUERY_PATH].totalCount).toBe(42);
        expect(queryLifecycle[QUERY_PATH].pageCount).toBe(5);
    });
});

describe("P161 triggerParamQueryRefresh — out-port refresh on params change", () => {
    let queryNode: any;

    function registerQuery(definition: Record<string, unknown>) {
        t.runtimeState.definitions.set(QUERY_ID, { nodeId: QUERY_ID, definition });
    }

    beforeEach(() => {
        t.runtimeState.liveState.clear();
        t.runtimeState.clientStateMap.clear();
        t.runtimeState.streamClients.clear();
        t.runtimeState.definitions.clear();
        t.runtimeState.queryDebounceTimers.clear();
        queryNode = { id: QUERY_ID, send: vi.fn() };
        t.runtimeState.RED = {
            nodes: { getNode: (id: string) => (id === QUERY_ID ? queryNode : undefined) },
            settings: { flowFile: "/nonexistent/p161-flows.json", userDir: "/tmp" },
            util: {}
        };
        // Seed a live broadcast state with an idle query envelope so the lifecycle
        // flip to `loading` has something to update.
        t.runtimeState.liveState.set(APP_ID, initializeState([], QUERIES, APP_ID));
        registerQuery({ type: "ui-query", id: QUERY_ID, queryPath: QUERY_PATH, params: STORE_ID });
    });

    afterEach(() => {
        t.runtimeState.RED = undefined;
    });

    it("emits a refresh on the query out-port carrying the current params", () => {
        triggerParamQueryRefresh(STORE_ID, { page: 2, pageSize: 10 }, APP_ID, undefined);
        expect(queryNode.send).toHaveBeenCalledTimes(1);
        const msg = queryNode.send.mock.calls[0][0];
        expect(msg.ui.query.queryPath).toBe(QUERY_PATH);
        expect(msg.ui.query.refresh).toBe(true);
        expect(msg.ui.query.params).toEqual({ page: 2, pageSize: 10 });
    });

    it("flips the observing query's lifecycle to loading without touching its data", () => {
        // Pre-load data so we can prove the refresh does NOT clobber it (no loop).
        t.runtimeState.liveState.set(
            APP_ID,
            applyQueryMessage(t.runtimeState.liveState.get(APP_ID), { queryPath: QUERY_PATH, data: [{ id: "c1" }], totalCount: 42 })
        );
        triggerParamQueryRefresh(STORE_ID, { page: 2 }, APP_ID, undefined);
        const env = t.runtimeState.liveState.get(APP_ID).ui.queries.list;
        expect(env.loading).toBe(true);
        expect(env.status).toBe("loading");
        // Data + totalCount survive — the data return arrives later on the in-port.
        expect(env.data).toEqual([{ id: "c1" }]);
        expect(env.totalCount).toBe(42);
    });

    it("targets the per-client state and carries clientId when given", () => {
        t.setClientState(APP_ID, "client-1", initializeState([], QUERIES, APP_ID), Date.now());
        triggerParamQueryRefresh(STORE_ID, { page: 3 }, APP_ID, "client-1");
        const msg = queryNode.send.mock.calls[0][0];
        expect(msg.ui.clientId).toBe("client-1");
        const env = t.getClientState(APP_ID, "client-1").state.ui.queries.list;
        expect(env.loading).toBe(true);
    });

    it("does not fire for a query whose params point at a different store", () => {
        registerQuery({ type: "ui-query", id: QUERY_ID, queryPath: QUERY_PATH, params: "otherStore" });
        triggerParamQueryRefresh(STORE_ID, { page: 2 }, APP_ID, undefined);
        expect(queryNode.send).not.toHaveBeenCalled();
    });

    it("with debounceMs set, coalesces rapid changes into a single out-port fire", () => {
        vi.useFakeTimers();
        registerQuery({ type: "ui-query", id: QUERY_ID, queryPath: QUERY_PATH, params: STORE_ID, debounceMs: 200 });
        triggerParamQueryRefresh(STORE_ID, { page: 2 }, APP_ID, undefined);
        triggerParamQueryRefresh(STORE_ID, { page: 3 }, APP_ID, undefined);
        triggerParamQueryRefresh(STORE_ID, { page: 4 }, APP_ID, undefined);
        expect(queryNode.send).not.toHaveBeenCalled();
        vi.advanceTimersByTime(200);
        expect(queryNode.send).toHaveBeenCalledTimes(1);
        expect(queryNode.send.mock.calls[0][0].ui.query.params).toEqual({ page: 4 });
        vi.useRealTimers();
    });
});
