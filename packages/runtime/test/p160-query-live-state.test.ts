import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        applyQueryMessage: (
            state: Record<string, unknown>,
            queryMsg: Record<string, unknown>
        ) => Record<string, unknown> | null;
        buildQuerySources: (
            state: Record<string, unknown>,
            queries: Array<{ queryPath?: string }>
        ) => { queries: Record<string, unknown>; queryLifecycle: Record<string, Record<string, unknown>> };
        initializeState: (
            stores: unknown[],
            queries: Array<{ queryPath?: string }>,
            appId: string
        ) => Record<string, unknown>;
    };
};

const { applyQueryMessage, buildQuerySources, initializeState } = webapp.__test__;

/**
 * P160 — server-side query live-state: the fix behind "everything empty".
 *
 * `applyQueryMessage` folds a `msg.ui.query` push into the live envelope at
 * `ui.queries.<queryPath>`; `buildQuerySources` splits those envelopes into the
 * renderer's two sources — the DATA tree (keyed by queryPath) and the lifecycle
 * map. Before P160, `buildAppSnapshot` passed `queries: {}` and the input handler
 * never persisted the push, so a `query:`-bound view always rendered empty.
 */

const QUERIES = [{ queryPath: "customers.list" }];

describe("P160 applyQueryMessage", () => {
    it("a data push records data + success status + clears any prior error", () => {
        const seed = initializeState([], QUERIES, "app1");
        const next = applyQueryMessage(seed, { queryPath: "customers.list", data: [{ id: "c1" }] });
        expect(next).not.toBeNull();
        const env = (next as Record<string, any>).ui.queries.customers.list;
        expect(env.data).toEqual([{ id: "c1" }]);
        expect(env.status).toBe("success");
        expect(env.error).toBeUndefined();
        expect(env.loading).toBe(false);
        expect(typeof env.updatedAt).toBe("number");
    });

    it("an error push records the error + error status without dropping last good data", () => {
        let state = initializeState([], QUERIES, "app1");
        state = applyQueryMessage(state, { queryPath: "customers.list", data: [{ id: "c1" }] })!;
        const next = applyQueryMessage(state, { queryPath: "customers.list", error: "Load failed" })!;
        const env = (next as Record<string, any>).ui.queries.customers.list;
        expect(env.error).toBe("Load failed");
        expect(env.status).toBe("error");
        expect(env.data).toEqual([{ id: "c1" }]);
    });

    it("a refresh push flips loading without touching data", () => {
        const seed = initializeState([], QUERIES, "app1");
        const next = applyQueryMessage(seed, { queryPath: "customers.list", refresh: true })!;
        const env = (next as Record<string, any>).ui.queries.customers.list;
        expect(env.loading).toBe(true);
        expect(env.status).toBe("loading");
    });

    it("returns null for an unrecognised / pathless message", () => {
        const seed = initializeState([], QUERIES, "app1");
        expect(applyQueryMessage(seed, { queryPath: "customers.list" })).toBeNull();
        expect(applyQueryMessage(seed, { data: [] })).toBeNull();
    });
});

describe("P160 buildQuerySources", () => {
    it("splits envelopes into a DATA tree (by queryPath) and a lifecycle map", () => {
        let state = initializeState([], QUERIES, "app1");
        state = applyQueryMessage(state, { queryPath: "customers.list", data: [{ id: "c1" }] })!;
        const { queries, queryLifecycle } = buildQuerySources(state, QUERIES);

        // DATA tree: `query:customers.list` reads the array.
        expect((queries as any).customers.list).toEqual([{ id: "c1" }]);
        // Lifecycle map: keyed by the exact queryPath string.
        expect(queryLifecycle["customers.list"].status).toBe("success");
        expect(queryLifecycle["customers.list"].loading).toBe(false);
    });

    it("an unpushed query has no data and an idle lifecycle", () => {
        const state = initializeState([], QUERIES, "app1");
        const { queries, queryLifecycle } = buildQuerySources(state, QUERIES);
        expect((queries as any).customers).toBeUndefined();
        expect(queryLifecycle["customers.list"].status).toBe("idle");
    });
});
