import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P225 (ADR 0037) — ui-alert Duration as a declarative `visible=false` state
 * transition.
 *
 * Duration is a WRITER on the ONE per-component visibility value, not a
 * client-side one-way close. The browser reports the elapsed duration by POSTing
 * `{ clientId, id, field:"visible", value:false }` to `/webapp/:appId/dynamic-state`;
 * the server routes that through the unified `setDynamicStateField` write API:
 *   - UNBOUND `visible` → the alert's internal per-client slot flips to false.
 *   - BOUND to a store → the write goes THROUGH to the store slice.
 * Writing the value back to `true` re-shows the alert (re-triggerable). There is
 * no `autoDismissed` flag and no "always emit open" overlay — the alert is hidden
 * because its visibility VALUE is false.
 *
 * These tests drive the server dispatch seam (`dispatchDynamicStateWrite`) the
 * browser POST reaches, and assert the resulting value transition on the state
 * tree (what the renderer reads).
 */

const wt = webappTest as unknown as {
    dispatchDynamicStateWrite: (
        body: Record<string, unknown>
    ) => { success: boolean; status?: number; body?: string; result?: { ok: boolean; mode?: string; reason?: string; clientId?: string } };
    dynamicStateSlotPath: (nodeId: string, field: string) => string;
    getClientState: (appId: string, clientId: string) => { state: Record<string, unknown> } | null;
    runtimeState: {
        liveState: Map<string, Record<string, unknown>>;
        definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
    };
};

const h = new NodeBehaviourHarness("durApp");

function registerAlert(id: string, extra: Record<string, unknown> = {}) {
    const definition = h.registry["ui-alert"].mapConfig({
        id,
        parent: h.appId,
        mount: `${h.appId}.content`,
        message: "hi",
        duration: 3000,
        ...extra
    });
    h.state.definitions.set(id, { nodeId: id, appId: h.appId, definition });
    return definition;
}

function registerStore(id: string, statePath: string, scope?: string) {
    const definition = h.registry["ui-store"].mapConfig({ id, statePath, ...(scope ? { scope } : {}) });
    h.state.definitions.set(id, { nodeId: id, appId: h.appId, definition });
    return definition;
}

function slotValue(state: Record<string, unknown> | undefined, nodeId: string, field: string): unknown {
    const root = state && (state.__dynamicState as Record<string, Record<string, unknown>> | undefined);
    return root && root[nodeId] ? root[nodeId][field] : undefined;
}

beforeEach(() => h.reset());
afterEach(() => h.teardown());

// ---------------------------------------------------------------------------
// 1. Duration hide is a value transition on the per-client slot (unbound).
// ---------------------------------------------------------------------------

describe("P225: duration auto-hide sets visible=false via the write API (unbound)", () => {
    it("POST { field:'visible', value:false } flips the alert's per-client slot to false", () => {
        registerAlert("al");

        // No writer yet → neutral (the renderer would fall back to visible=true).
        expect(wt.getClientState(h.appId, "c1")).toBeNull();

        // The browser reports the elapsed duration → the unified write API.
        const res = wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", field: "visible", value: false });
        expect(res.success).toBe(true);
        expect(res.result).toMatchObject({ ok: true, mode: "slot", clientId: "c1" });

        // The ONE visibility value is now false — a real state transition.
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
    });

    it("is re-triggerable: writing visible=true again re-shows the alert (no reload)", () => {
        registerAlert("al");

        wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", field: "visible", value: false });
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);

        const reshow = wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", field: "visible", value: true });
        expect(reshow.success).toBe(true);
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(true);
    });

    it("two clients auto-hide independently (per-client slot isolation)", () => {
        registerAlert("al");

        wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", field: "visible", value: false });
        // c2's timer has not elapsed → it stays visible (no slot value).

        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        expect(wt.getClientState(h.appId, "c2")).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 2. Duration hide writes THROUGH to a bound store.
// ---------------------------------------------------------------------------

describe("P225: duration auto-hide writes through a bound store", () => {
    it("a store-bound visible flips the STORE slice to false (durchgeschrieben), not a slot", () => {
        registerStore("visStore", "vis");
        registerAlert("al", { visible: { kind: "store", path: "visStore" } });

        const res = wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", field: "visible", value: false });
        expect(res.success).toBe(true);
        expect(res.result).toMatchObject({ ok: true, mode: "store", clientId: "c1" });

        expect(wt.getClientState(h.appId, "c1")!.state.vis).toBe(false);
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBeUndefined();

        // Re-triggerable through the same store binding.
        wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", field: "visible", value: true });
        expect(wt.getClientState(h.appId, "c1")!.state.vis).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 3. Dispatch guards (bad request / conflict mapping).
// ---------------------------------------------------------------------------

describe("P225: dispatchDynamicStateWrite guards", () => {
    it("rejects a missing id", () => {
        expect(wt.dispatchDynamicStateWrite({ clientId: "c1", field: "visible", value: false }))
            .toMatchObject({ success: false, status: 400, body: "Missing id." });
    });

    it("rejects a missing field", () => {
        registerAlert("al");
        expect(wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", value: false }))
            .toMatchObject({ success: false, status: 400, body: "Missing field." });
    });

    it("maps an unknown node to 400", () => {
        expect(wt.dispatchDynamicStateWrite({ clientId: "c1", id: "nope", field: "visible", value: false }))
            .toMatchObject({ success: false, status: 400, body: "unknown-node" });
    });

    it("maps a read-only bound source (reactive) to 409", () => {
        registerAlert("al", { visible: { kind: "reactive", value: "1 > 0" } });
        expect(wt.dispatchDynamicStateWrite({ clientId: "c1", id: "al", field: "visible", value: false }))
            .toMatchObject({ success: false, status: 409, body: "read-only-bound" });
    });
});
