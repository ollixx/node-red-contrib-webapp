import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P175 — ui-query: terminal data/error return (no infinite loop).
 *
 * The `queryInputHandler` MUST NOT call `send(msg)` when the incoming message
 * is a data/error return (the datasource result flowing BACK to the in-port).
 * Forwarding it would re-trigger the datasource → endlessly.
 *
 * Terminal contract (ADR 0016 + spec):
 *   • `msg.ui.query.data`  (matching queryPath) → absorbed, 0 out-emits
 *   • `msg.ui.query.error` (matching queryPath) → absorbed, 0 out-emits
 *   • trigger / `refresh:true` / `loading:true` → 1 out-emit (trigger must reach datasource)
 *   • foreign / unrecognised message  → 1 out-emit (pass-through unchanged)
 */

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

const APP_ID = "p175-app";
const QUERY_ID = "p175-query";
const QUERY_PATH = "customers.list";

const QUERIES = [{ queryPath: QUERY_PATH }];

function makeNode(): any {
    return { id: QUERY_ID, z: undefined };
}

describe("P175 queryInputHandler — terminal data/error (no loop)", () => {
    let node: any;

    beforeEach(() => {
        // Reset shared mutable state.
        t.runtimeState.liveState.clear();
        t.runtimeState.clientStateMap.clear();
        t.runtimeState.streamClients.clear();
        t.runtimeState.definitions.clear();
        t.runtimeState.queryEtags.clear();

        // Register a ui-app so findAppIdForNode (→ getActiveRuntimeAppId) returns APP_ID.
        t.runtimeState.definitions.set(APP_ID, {
            nodeId: APP_ID,
            definition: { type: "ui-app", id: APP_ID }
        });

        // Register the ui-query definition so getDefinitionBuckets can build queryDefs.
        t.runtimeState.definitions.set(QUERY_ID, {
            nodeId: QUERY_ID,
            definition: { type: "ui-query", id: QUERY_ID, queryPath: QUERY_PATH, parent: APP_ID }
        });

        // Seed a live state so applyQueryMessage has a base to work with.
        t.runtimeState.liveState.set(APP_ID, t.initializeState([], QUERIES, APP_ID));

        // Minimal RED mock: no stream clients means pushSnapshotToClients is a no-op.
        t.runtimeState.RED = {
            nodes: { getNode: (_id: string) => undefined },
            settings: { flowFile: "/nonexistent/p175-flows.json", userDir: "/tmp" },
            util: {}
        };

        node = makeNode();
    });

    afterEach(() => {
        t.runtimeState.RED = undefined;
    });

    // ── terminal returns ────────────────────────────────────────────────────

    it("data return: send is NOT called (absorbed, terminal)", () => {
        const send = vi.fn();
        const done = vi.fn();
        const msg = {
            ui: {
                query: { queryPath: QUERY_PATH, data: [{ id: "c1" }] }
            }
        };
        t.queryInputHandler(node, msg, send, done);
        expect(send).toHaveBeenCalledTimes(0);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("error return: send is NOT called (absorbed, terminal)", () => {
        const send = vi.fn();
        const done = vi.fn();
        const msg = {
            ui: {
                query: { queryPath: QUERY_PATH, error: "DB unavailable" }
            }
        };
        t.queryInputHandler(node, msg, send, done);
        expect(send).toHaveBeenCalledTimes(0);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("data return still updates live state (state + push happened)", () => {
        const send = vi.fn();
        const msg = {
            ui: {
                query: { queryPath: QUERY_PATH, data: [{ id: "c1" }, { id: "c2" }] }
            }
        };
        t.queryInputHandler(node, msg, send, undefined);
        // send suppressed — state update must still have happened.
        const env = t.runtimeState.liveState.get(APP_ID)?.ui?.queries?.customers?.list;
        expect(env?.status).toBe("success");
        expect(env?.data).toEqual([{ id: "c1" }, { id: "c2" }]);
    });

    it("error return still updates live state (state + push happened)", () => {
        const send = vi.fn();
        const msg = {
            ui: {
                query: { queryPath: QUERY_PATH, error: "timeout" }
            }
        };
        t.queryInputHandler(node, msg, send, undefined);
        expect(send).toHaveBeenCalledTimes(0);
        const env = t.runtimeState.liveState.get(APP_ID)?.ui?.queries?.customers?.list;
        expect(env?.status).toBe("error");
        expect(env?.error).toBe("timeout");
    });

    // ── trigger messages — MUST reach the datasource via out-port ─────────

    it("trigger without data/error: send IS called once (trigger reaches datasource)", () => {
        const send = vi.fn();
        // A raw onEnter trigger carries no msg.ui.query payload.
        const msg = { ui: { event: "onEnter" } };
        t.queryInputHandler(node, msg, send, undefined);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("refresh:true: send IS called once (manual re-trigger)", () => {
        const send = vi.fn();
        const msg = {
            ui: {
                query: { queryPath: QUERY_PATH, refresh: true }
            }
        };
        t.queryInputHandler(node, msg, send, undefined);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("loading:true: send IS called once (loading signal is a trigger)", () => {
        const send = vi.fn();
        const msg = {
            ui: {
                query: { queryPath: QUERY_PATH, loading: true }
            }
        };
        t.queryInputHandler(node, msg, send, undefined);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("foreign message (no msg.ui.query): passes through unchanged", () => {
        const send = vi.fn();
        const msg = { payload: "hello", topic: "foreign" };
        t.queryInputHandler(node, msg, send, undefined);
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBe(msg);
    });

    it("unrecognised msg.ui.query (no data/error/refresh/loading): passes through", () => {
        const send = vi.fn();
        // A bare queryPath with no action field — applyQueryMessage returns null.
        const msg = {
            ui: {
                query: { queryPath: QUERY_PATH }
            }
        };
        t.queryInputHandler(node, msg, send, undefined);
        expect(send).toHaveBeenCalledTimes(1);
    });
});
