import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P218 (ADR 0033) — a consumed `msg.ui.<command>` envelope is removed after
 * SUCCESSFUL processing, so it cannot be double-processed downstream.
 *
 * Rules proven here at the HANDLER level (the real webapp.js input handlers):
 *   • the consumed sub-key is removed on success;
 *   • context (`clientId`, an outgoing `event`) is preserved; `msg.ui` is never nuked;
 *   • the error / not-applied path LEAVES the envelope (diagnosable / retryable);
 *   • the owner's refresh→replace repro: after a ui-query refresh hop the stale
 *     `msg.payload` is gone, so a downstream replace-consumer cannot fold it as data;
 *   • apply-once: a chain of two consumers of the same command type applies once.
 */

const require = createRequire(import.meta.url);
/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

const {
    runtimeNodeRegistry,
    runtimeState,
    queryInputHandler,
    dialogInputHandler,
    stripConsumedUiEnvelope,
    normalizeStoreOperationMessage,
    initializeState
} = t;

const APP_ID = "p218App";
const QUERY_ID = "p218Query";
const QUERY_NODE_ID = "p218QueryNode";
const QUERY_PATH = "entities";
const STORE_ID = "p218Store";

function registerApp() {
    const def = runtimeNodeRegistry["ui-app"].mapConfig({ id: APP_ID, root: APP_ID, name: "App", layout: "app" });
    runtimeState.definitions.set(APP_ID, { nodeId: APP_ID, appId: APP_ID, definition: def });
}

function registerQuery(overrides: Record<string, unknown> = {}) {
    const def = runtimeNodeRegistry["ui-query"].mapConfig({ id: QUERY_ID, parent: APP_ID, queryPath: QUERY_PATH, ...overrides });
    runtimeState.definitions.set(QUERY_NODE_ID, { nodeId: QUERY_NODE_ID, appId: APP_ID, definition: def });
    return def;
}

function queryNode() {
    return { id: QUERY_NODE_ID, webappDefinition: runtimeState.definitions.get(QUERY_NODE_ID)!.definition };
}

function registerStore(statePath: string, initialValue?: string, scope?: string) {
    const config: Record<string, unknown> = { id: STORE_ID, parent: APP_ID, statePath };
    if (initialValue !== undefined) { config.initialValue = initialValue; }
    if (scope !== undefined) { config.scope = scope; }
    const def = runtimeNodeRegistry["ui-store"].mapConfig(config);
    runtimeState.definitions.set(STORE_ID, { nodeId: STORE_ID, appId: APP_ID, definition: def });
    return def;
}

function storeNode() {
    return { id: STORE_ID, z: undefined, webappDefinition: runtimeState.definitions.get(STORE_ID)!.definition };
}

const uiStore = () => runtimeNodeRegistry["ui-store"];

function seedLive(state?: any) {
    runtimeState.liveState.set(APP_ID, state ?? initializeState([], [{ queryPath: QUERY_PATH }], APP_ID));
}

beforeEach(() => {
    runtimeState.liveState.clear();
    runtimeState.clientStateMap.clear();
    if (runtimeState.streamClients) { runtimeState.streamClients.clear(); }
    runtimeState.definitions.clear();
    if (runtimeState.queryEtags) { runtimeState.queryEtags.clear(); }
    runtimeState.RED = {
        nodes: { getNode: () => undefined },
        settings: { flowFile: "/nonexistent/p218-flows.json", userDir: "/tmp" },
        util: {}
    };
    registerApp();
});

afterEach(() => {
    runtimeState.RED = undefined;
});

// ---------------------------------------------------------------------------
// stripConsumedUiEnvelope — the shared helper contract
// ---------------------------------------------------------------------------

describe("P218 stripConsumedUiEnvelope", () => {
    it("removes ONLY the named sub-key, preserving clientId + event, never mutating input", () => {
        const msg = { payload: 1, ui: { clientId: "c1", event: "click", store: { id: "s", op: "set" } } };
        const out = stripConsumedUiEnvelope(msg, "store");
        expect(out.ui.store).toBeUndefined();
        expect(out.ui.clientId).toBe("c1");
        expect(out.ui.event).toBe("click");
        expect(out.payload).toBe(1);
        // caller's object untouched (P175/P214 byte-identity for messages we touch NOT relied on,
        // but we must never corrupt the source):
        expect(msg.ui.store).toEqual({ id: "s", op: "set" });
    });

    it("leaves an emptied msg.ui as {} (documented choice — never deletes the whole ui)", () => {
        const out = stripConsumedUiEnvelope({ ui: { dialog: { op: "open" } } }, "dialog");
        expect(out.ui).toEqual({});
    });

    it("returns the SAME message untouched when the sub-key is absent or there is no ui", () => {
        const noKey = { ui: { clientId: "c1" } };
        expect(stripConsumedUiEnvelope(noKey, "dialog")).toBe(noKey);
        const noUi = { payload: 1 };
        expect(stripConsumedUiEnvelope(noUi, "dialog")).toBe(noUi);
    });
});

// ---------------------------------------------------------------------------
// queryInputHandler — refresh consumed → clean fetch trigger (no stale payload)
// ---------------------------------------------------------------------------

describe("P218 queryInputHandler drops the stale payload of a consumed refresh", () => {
    it("a refresh with an incidental msg.payload forwards a CLEAN trigger (payload gone, ui.query kept)", () => {
        registerQuery();
        seedLive();
        const send = vi.fn();
        queryInputHandler(
            queryNode(),
            { payload: [{ id: "STALE" }], ui: { query: { queryPath: QUERY_PATH, refresh: true } } },
            send,
            vi.fn()
        );
        expect(send).toHaveBeenCalledTimes(1);
        const out = send.mock.calls[0][0];
        // The fetch still receives what it needs …
        expect(out.ui.query).toMatchObject({ queryPath: QUERY_PATH, refresh: true });
        // … but the stale trigger payload is NOT carried forward (would be re-consumed
        // downstream as query DATA by a `replace`).
        expect("payload" in out).toBe(false);
    });

    it("keeps the freshly-resolved params on the clean trigger (P214 unregressed)", () => {
        registerQuery();
        const state: any = initializeState([], [{ queryPath: QUERY_PATH }], APP_ID);
        state.ui.queries[QUERY_PATH].params = { page: 3 };
        seedLive(state);
        const send = vi.fn();
        queryInputHandler(
            queryNode(),
            { payload: { junk: true }, ui: { query: { queryPath: QUERY_PATH, refresh: true } } },
            send,
            vi.fn()
        );
        const out = send.mock.calls[0][0];
        expect(out.ui.query).toMatchObject({ queryPath: QUERY_PATH, refresh: true, params: { page: 3 } });
        expect("payload" in out).toBe(false);
    });

    it("NOT-applied path (no app registered) LEAVES the envelope + payload (byte-identical)", () => {
        // No ui-query registered / findAppIdForNode → cannot apply: this is a
        // pass-through, NOT a consumed command → nothing is stripped.
        runtimeState.definitions.clear(); // remove the app too → no appId
        const send = vi.fn();
        const msg = { payload: [{ id: "x" }], ui: { query: { queryPath: QUERY_PATH, refresh: true } } };
        queryInputHandler({ id: "orphan", webappDefinition: { type: "ui-query", id: "orphan" } }, msg, send, vi.fn());
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toBe(msg);
        expect(send.mock.calls[0][0].payload).toEqual([{ id: "x" }]);
    });

    it("preserves clientId on the clean trigger", () => {
        registerQuery();
        seedLive();
        const send = vi.fn();
        queryInputHandler(
            queryNode(),
            { payload: "stale", ui: { clientId: "c7", query: { queryPath: QUERY_PATH, refresh: true } } },
            send,
            vi.fn()
        );
        expect(send.mock.calls[0][0].ui.clientId).toBe("c7");
        expect("payload" in send.mock.calls[0][0]).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// The owner repro: refresh-action (wire) → ui-query → replace-consumer
// ---------------------------------------------------------------------------

describe("P218 refresh→replace repro — stale payload cannot overwrite the query", () => {
    it("after the refresh hop, a downstream replace-consumer folds NO stale rows", () => {
        registerQuery();
        seedLive();

        // 1) ui-query-action refresh (wire) emits the refresh envelope, spreading the
        //    incidental trigger payload (its documented behaviour — the EMITTER).
        const qaRefreshDef = runtimeNodeRegistry["ui-query-action"].mapConfig({
            id: "qaR", parent: APP_ID, query: QUERY_ID, action: "refresh", mode: "wire"
        });
        const refreshOut = vi.fn();
        runtimeNodeRegistry["ui-query-action"].options.inputHandler(
            { id: "qaR", webappDefinition: qaRefreshDef },
            { payload: [{ id: "STALE-TRIGGER" }], ui: {} },
            refreshOut,
            vi.fn()
        );
        const refreshMsg = refreshOut.mock.calls[0][0];
        expect(refreshMsg.ui.query).toMatchObject({ queryPath: QUERY_PATH, refresh: true });
        expect(refreshMsg.payload).toEqual([{ id: "STALE-TRIGGER" }]); // emitter kept it

        // 2) ui-query CONSUMES the refresh and forwards the CLEAN trigger.
        const qOut = vi.fn();
        queryInputHandler(queryNode(), refreshMsg, qOut, vi.fn());
        const forwarded = qOut.mock.calls[0][0];
        expect("payload" in forwarded).toBe(false); // <-- the fix

        // 3) A downstream ui-query-action REPLACE (wire) reads msg.payload as DATA.
        //    With the stale payload gone it replaces with [] — NOT the stale rows.
        const qaReplaceDef = runtimeNodeRegistry["ui-query-action"].mapConfig({
            id: "qaP", parent: APP_ID, query: QUERY_ID, action: "replace", mode: "wire"
        });
        const replaceOut = vi.fn();
        runtimeNodeRegistry["ui-query-action"].options.inputHandler(
            { id: "qaP", webappDefinition: qaReplaceDef },
            forwarded,
            replaceOut,
            vi.fn()
        );
        const replaceMsg = replaceOut.mock.calls[0][0];
        expect(replaceMsg.ui.query.data).toEqual([]); // NOT [{ id: "STALE-TRIGGER" }]
    });
});

// ---------------------------------------------------------------------------
// dialogInputHandler — consumed dialog op removed; apply-once
// ---------------------------------------------------------------------------

describe("P218 dialogInputHandler removes the consumed op envelope", () => {
    it("valid op → forwards with msg.ui.dialog stripped, clientId/event preserved", () => {
        const send = vi.fn();
        dialogInputHandler({}, { ui: { clientId: "c1", event: "onOpen", dialog: { id: "d", op: "open" } } }, send, undefined);
        const out = send.mock.calls[0][0];
        expect(out.ui.dialog).toBeUndefined();
        expect(out.ui.clientId).toBe("c1");
        expect(out.ui.event).toBe("onOpen");
    });

    it("apply-once: feeding the forwarded message to a second dialog consumer applies nothing", () => {
        const send1 = vi.fn();
        dialogInputHandler({}, { ui: { dialog: { id: "d", op: "open" } } }, send1, undefined);
        const forwarded = send1.mock.calls[0][0];
        const send2 = vi.fn();
        dialogInputHandler({}, forwarded, send2, undefined);
        expect(send2).toHaveBeenCalledTimes(1);
        expect(send2.mock.calls[0][0].ui.dialog).toBeUndefined();
    });

    it("unknown op → NOT successful → discarded (no send); envelope not forwarded", () => {
        const send = vi.fn();
        dialogInputHandler({}, { ui: { dialog: { id: "d", op: "bogus" } } }, send, undefined);
        expect(send).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// ui-store — a consumed command's notification is not re-applied (apply-once)
// ---------------------------------------------------------------------------

describe("P218 ui-store: a spent `changed`/`read` notification is not a command", () => {
    it("normalizeStoreOperationMessage rejects an event-bearing (notification) envelope", () => {
        const def = registerStore("entity", '{"name":"A"}');
        // a real command (no event) is accepted
        expect(normalizeStoreOperationMessage({ ui: { store: { id: STORE_ID, op: "set", value: "B" } } }, def))
            .toMatchObject({ id: STORE_ID, op: "set", value: "B" });
        // a changed notification (has event) is rejected — not re-consumable
        expect(normalizeStoreOperationMessage({ ui: { store: { id: STORE_ID, op: "set", event: "changed", value: "B" } } }, def))
            .toBeUndefined();
        // a read notification is rejected too
        expect(normalizeStoreOperationMessage({ ui: { store: { id: STORE_ID, op: "set", event: "read", value: "B" } } }, def))
            .toBeUndefined();
    });

    it("apply-once: the changed notification of a ui-store write is NOT re-applied by a second ui-store hop", () => {
        registerStore("entity", '{"name":"A","city":"X"}');
        runtimeState.liveState.set(APP_ID, { entity: { name: "A", city: "X" } });

        // 1) command: delete city → applied once, emits a `changed` notification.
        const send1 = vi.fn();
        uiStore().options.inputHandler(storeNode(), { ui: { store: { id: STORE_ID, op: "delete", path: "city" } } }, send1, vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A" } });
        const changed = send1.mock.calls[0][0];
        expect(changed.ui.store).toMatchObject({ id: STORE_ID, event: "changed", op: "delete", previousValue: "X" });

        // 2) feed that notification back into a ui-store hop → pass-through, NOT re-applied.
        const send2 = vi.fn();
        const backMsg = { ui: { store: changed.ui.store } };
        uiStore().options.inputHandler(storeNode(), backMsg, send2, vi.fn());
        expect(send2).toHaveBeenCalledTimes(1);
        // pass-through: the exact message forwarded, no fresh apply, state unchanged.
        expect(send2.mock.calls[0][0]).toBe(backMsg);
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "A" } });
    });

    it("a real command (no event) still applies (guard does not over-reach)", () => {
        registerStore("entity", '{"name":"A"}');
        runtimeState.liveState.set(APP_ID, { entity: { name: "A" } });
        const send = vi.fn();
        uiStore().options.inputHandler(storeNode(), { ui: { store: { id: STORE_ID, op: "set", path: "name", value: "B" } } }, send, vi.fn());
        expect(runtimeState.liveState.get(APP_ID)).toEqual({ entity: { name: "B" } });
        expect(send.mock.calls[0][0].ui.store).toMatchObject({ event: "changed", value: "B" });
    });
});
