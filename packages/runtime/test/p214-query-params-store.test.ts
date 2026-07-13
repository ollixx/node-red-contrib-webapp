import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P214 (ADR 0030) — every ui-query implicitly owns a per-client params store
 * slice at `ui.queries.<queryPath>.params`, addressable by the query's node id
 * exactly like a real ui-store. These tests exercise the REAL runtime against
 * that contract — never DOM-presence:
 *
 *   1. resolution: a `store` reference id that matches a ui-query resolves to a
 *      synthetic store definition targeting its params slice; a real ui-store id
 *      still resolves to the real store; an unknown id → undefined.
 *   2. write: ui-store-action(store=<queryId>, set page=2) writes
 *      `ui.queries.<queryPath>.params.page` — per-client under clientId.
 *   3. read: ui-store-read(store=<queryId>) returns the params value.
 *   4. reactive refresh: writing the implicit params fires the query's out-port
 *      refresh (P161 mechanism) carrying the current params.
 *   5. override: with an EXPLICIT params store set, writing the external store
 *      still fires the query; the query's own id is NOT an implicit target.
 *   6. per-client: params written under a clientId land only in that client slice.
 */

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

const {
    runtimeNodeRegistry,
    runtimeState,
    resolveStoreReferenceById,
    findQueryParamsStoreDefinitionById,
    triggerParamQueryRefresh,
    initializeState
} = t;

const APP_ID = "p214App";
const QUERY_ID = "p214Query";
const QUERY_PATH = "entities";
const STORE_ID = "p214Store";

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({
        id: APP_ID, root: APP_ID, name: "P214 App", layout: "app"
    });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def });
}

function registerQuery(overrides: Record<string, unknown> = {}) {
    const def = runtimeNodeRegistry["ui-query"].mapConfig({
        id: QUERY_ID, parent: APP_ID, queryPath: QUERY_PATH, name: "Entities", ...overrides
    });
    runtimeState.definitions.set(QUERY_ID, { nodeId: QUERY_ID, appId: APP_ID, definition: def });
    return def;
}

function registerStore(statePath: string, initialValue?: string) {
    const config: Record<string, unknown> = { id: STORE_ID, parent: APP_ID, statePath };
    if (initialValue !== undefined) { config.initialValue = initialValue; }
    const def = runtimeNodeRegistry["ui-store"].mapConfig(config);
    runtimeState.definitions.set(STORE_ID, { nodeId: STORE_ID, appId: APP_ID, definition: def });
    return def;
}

function makeActionNode(overrides: Record<string, unknown> = {}) {
    const config: Record<string, unknown> = { id: "p214Act", parent: APP_ID, store: QUERY_ID, ...overrides };
    const def = runtimeNodeRegistry["ui-store-action"].mapConfig(config);
    return {
        id: "p214Act",
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(m: string) { this.errors.push(m); },
        warn(m: string) { this.warns.push(m); }
    };
}

function makeReadNode(overrides: Record<string, unknown> = {}) {
    const config: Record<string, unknown> = { id: "p214Read", parent: APP_ID, store: QUERY_ID, ...overrides };
    const def = runtimeNodeRegistry["ui-store-read"].mapConfig(config);
    return {
        id: "p214Read",
        webappDefinition: def,
        errors: [] as string[],
        warns: [] as string[],
        error(m: string) { this.errors.push(m); },
        warn(m: string) { this.warns.push(m); }
    };
}

const action = () => runtimeNodeRegistry["ui-store-action"];
const read = () => runtimeNodeRegistry["ui-store-read"];

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    runtimeState.queryDebounceTimers.clear();
    runtimeState.RED = undefined;
});

// ---------------------------------------------------------------------------
// 1. Resolution: query id → implicit params store; store id → real store
// ---------------------------------------------------------------------------

describe("P214 store-reference resolution", () => {
    it("resolves a ui-query id to a synthetic store targeting its params slice", () => {
        registerApp();
        registerQuery();
        const def = findQueryParamsStoreDefinitionById(QUERY_ID);
        expect(def).toMatchObject({
            id: QUERY_ID,
            statePath: `ui.queries.${QUERY_PATH}.params`,
            __queryParamsStore: true,
            queryPath: QUERY_PATH
        });
        // resolveStoreReferenceById funnels through the same synthetic def.
        expect(resolveStoreReferenceById(QUERY_ID)).toMatchObject({
            statePath: `ui.queries.${QUERY_PATH}.params`,
            __queryParamsStore: true
        });
    });

    it("a real ui-store id still resolves to the real store (not a query slice)", () => {
        registerApp();
        registerStore("draft.customer");
        const def = resolveStoreReferenceById(STORE_ID);
        expect(def).toMatchObject({ type: "ui-store", id: STORE_ID, statePath: "draft.customer" });
        expect(def.__queryParamsStore).toBeUndefined();
    });

    it("an unknown id resolves to undefined; a query without a queryPath is not a target", () => {
        registerApp();
        expect(resolveStoreReferenceById("nope")).toBeUndefined();
        // A ui-query with no queryPath cannot own a params slice.
        runtimeState.definitions.set(QUERY_ID, {
            nodeId: QUERY_ID, appId: APP_ID, definition: { type: "ui-query", id: QUERY_ID }
        });
        expect(findQueryParamsStoreDefinitionById(QUERY_ID)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 2. Write via ui-store-action → params.<path> in the query slice
// ---------------------------------------------------------------------------

describe("P214 ui-store-action writes the implicit params slice", () => {
    beforeEach(() => {
        registerApp();
        registerQuery();
        runtimeState.liveState.set(APP_ID, initializeState([], [{ queryPath: QUERY_PATH }], APP_ID));
    });

    it("set page=2 writes ui.queries.<path>.params.page (broadcast)", () => {
        const node = makeActionNode({ op: "set", path: "page" });
        const send = vi.fn();
        action().options.inputHandler(node, { payload: 2, ui: {} }, send, vi.fn());
        const state = runtimeState.liveState.get(APP_ID) as any;
        expect(state.ui.queries[QUERY_PATH].params).toEqual({ page: 2 });
        // The change notification carries the query id as the store reference.
        const out = send.mock.calls[0][0] as { ui: { store: Record<string, unknown> } };
        expect(out.ui.store).toMatchObject({ id: QUERY_ID, event: "changed", op: "set", path: "page", value: 2 });
    });

    it("patch merges into params without clobbering the query data envelope", () => {
        // Seed data alongside so we can prove params is a SIBLING of data.
        runtimeState.liveState.set(
            APP_ID,
            t.applyQueryMessage(runtimeState.liveState.get(APP_ID), { queryPath: QUERY_PATH, data: [{ id: "a" }] })
        );
        const node = makeActionNode({ op: "patch", path: "" });
        action().options.inputHandler(node, { payload: { page: 3, sort: "name" }, ui: {} }, vi.fn(), vi.fn());
        const env = (runtimeState.liveState.get(APP_ID) as any).ui.queries[QUERY_PATH];
        expect(env.params).toEqual({ page: 3, sort: "name" });
        expect(env.data).toEqual([{ id: "a" }]);
    });

    it("per-client: params under a clientId land only in that client slice", () => {
        t.setClientState(APP_ID, "c1", initializeState([], [{ queryPath: QUERY_PATH }], APP_ID), Date.now());
        const node = makeActionNode({ op: "set", path: "page" });
        action().options.inputHandler(node, { payload: 5, ui: { clientId: "c1" } }, vi.fn(), vi.fn());
        const client = t.getClientState(APP_ID, "c1").state.ui.queries[QUERY_PATH].params;
        expect(client).toEqual({ page: 5 });
        // broadcast slice untouched (still no params)
        const broadcast = (runtimeState.liveState.get(APP_ID) as any).ui.queries[QUERY_PATH].params;
        expect(broadcast).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 3. Read via ui-store-read
// ---------------------------------------------------------------------------

describe("P214 ui-store-read reads the implicit params slice", () => {
    beforeEach(() => {
        registerApp();
        registerQuery();
    });

    it("returns the params value at a sub-path, per-client", () => {
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 7, sort: "name" };
        t.setClientState(APP_ID, "c1", state, Date.now());

        const node = makeReadNode({ path: "page" });
        const send = vi.fn();
        read().options.inputHandler(node, { ui: { clientId: "c1" } }, send, vi.fn());
        const out = send.mock.calls[0][0] as { payload: unknown; ui: { store: Record<string, unknown> } };
        expect(out.payload).toBe(7);
        expect(out.ui.store).toMatchObject({ id: QUERY_ID, event: "read", value: 7 });
    });

    it("returns the whole params object when no sub-path is given", () => {
        const s: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        s.ui.queries[QUERY_PATH].params = { page: 1, pageSize: 20 };
        runtimeState.liveState.set(APP_ID, s);
        const node = makeReadNode({ path: "" });
        const send = vi.fn();
        read().options.inputHandler(node, { ui: {} }, send, vi.fn());
        expect((send.mock.calls[0][0] as any).payload).toEqual({ page: 1, pageSize: 20 });
    });
});

// ---------------------------------------------------------------------------
// 4. + 5. Reactive refresh via the store-action write; explicit-params override
// ---------------------------------------------------------------------------

describe("P214 reactive refresh + explicit override", () => {
    let queryNode: any;

    beforeEach(() => {
        queryNode = { id: QUERY_ID, send: vi.fn() };
        runtimeState.RED = {
            nodes: { getNode: (id: string) => (id === QUERY_ID ? queryNode : undefined) },
            settings: { flowFile: "/nonexistent/p214-flows.json", userDir: "/tmp" },
            util: {}
        };
        registerApp();
    });

    afterEach(() => {
        runtimeState.RED = undefined;
    });

    it("writing the implicit params (via ui-store-action) fires the query's out-port refresh with the new params", () => {
        registerQuery(); // no explicit params → implicit is the default
        runtimeState.liveState.set(APP_ID, initializeState([], [{ queryPath: QUERY_PATH }], APP_ID));

        const node = makeActionNode({ op: "set", path: "page" });
        action().options.inputHandler(node, { payload: 2, ui: {} }, vi.fn(), vi.fn());

        expect(queryNode.send).toHaveBeenCalledTimes(1);
        const emitted = queryNode.send.mock.calls[0][0];
        expect(emitted.ui.query.queryPath).toBe(QUERY_PATH);
        expect(emitted.ui.query.refresh).toBe(true);
        expect(emitted.ui.query.params).toEqual({ page: 2 });
    });

    it("triggerParamQueryRefresh matches a query by its OWN id (implicit target)", () => {
        registerQuery();
        runtimeState.liveState.set(APP_ID, initializeState([], [{ queryPath: QUERY_PATH }], APP_ID));
        triggerParamQueryRefresh(QUERY_ID, { page: 9 }, APP_ID, undefined);
        expect(queryNode.send).toHaveBeenCalledTimes(1);
        expect(queryNode.send.mock.calls[0][0].ui.query.params).toEqual({ page: 9 });
    });

    it("OVERRIDE: with an explicit params store set, the query's own id is NOT an implicit target", () => {
        registerStore("filters", "{}");
        registerQuery({ params: STORE_ID }); // explicit external store
        runtimeState.liveState.set(APP_ID, initializeState([], [{ queryPath: QUERY_PATH }], APP_ID));

        // A change addressed at the query's own id must NOT fire (explicit wins).
        triggerParamQueryRefresh(QUERY_ID, { page: 2 }, APP_ID, undefined);
        expect(queryNode.send).not.toHaveBeenCalled();

        // But the EXPLICIT external store still drives the refresh (P161 unchanged).
        triggerParamQueryRefresh(STORE_ID, { page: 2 }, APP_ID, undefined);
        expect(queryNode.send).toHaveBeenCalledTimes(1);
        expect(queryNode.send.mock.calls[0][0].ui.query.params).toEqual({ page: 2 });
    });

    it("carries clientId so the wired fetch targets the same client (per-client)", () => {
        registerQuery();
        t.setClientState(APP_ID, "c7", initializeState([], [{ queryPath: QUERY_PATH }], APP_ID), Date.now());
        const node = makeActionNode({ op: "set", path: "page" });
        action().options.inputHandler(node, { payload: 4, ui: { clientId: "c7" } }, vi.fn(), vi.fn());
        expect(queryNode.send).toHaveBeenCalledTimes(1);
        expect(queryNode.send.mock.calls[0][0].ui.clientId).toBe("c7");
    });
});
