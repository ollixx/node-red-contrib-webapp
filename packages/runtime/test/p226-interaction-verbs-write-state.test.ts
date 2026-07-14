import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { INTERACTION_VERBS_BY_TYPE, NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P226 (ADR 0037) — `ui-action` interaction verbs write the ONE dynamic-state
 * value instead of pushing a client-side overlay.
 *
 * The target node's interaction handler no longer pushes a `.webapp-hidden` /
 * [disabled] overlay `command` for the visibility / enabled verbs. Instead:
 *   - `show` / `hide`    → set the target's `visible`  value (true / false)
 *   - `enable` / `disable` → set the target's `disabled` value (false / true)
 * through the unified `setDynamicStateField` write API:
 *   - UNBOUND (literal / none) → the node's internal per-client slot
 *     (`__dynamicState.<id>.<field>`), scoped by the reported clientId.
 *   - BOUND to a store → the write goes THROUGH to the store slice (the store
 *     stays the single truth), scope-correct.
 * The resulting snapshot re-render reflects the new value — visibility follows the
 * value, not a separate CSS layer. `ui-alert` is now a valid target (it gained the
 * visibility verbs). Every other verb (navigate / open / close / select / focus /
 * reset) keeps its client command — verified by the p59/p82/p83/p85 suites.
 *
 * These tests drive the REAL registered interaction handlers via the shared
 * NodeBehaviourHarness and assert the resulting value transition on the state tree
 * (what the renderer reads), plus that the msg passes through and no `command`
 * frame is written for a dynamic-state verb.
 */

const wt = webappTest as unknown as {
    getClientState: (appId: string, clientId: string) => { state: Record<string, unknown> } | null;
    setDynamicStateField: (
        nodeId: string,
        field: string,
        value: unknown,
        clientId?: string
    ) => { ok: boolean; mode?: string; reason?: string; clientId?: string };
    buildAppSnapshot: (
        appId: string,
        location: string,
        dialogId: string | undefined,
        definitions: Record<string, unknown>[],
        clientId?: string
    ) => { success: boolean; snapshot?: unknown; message?: string };
    runtimeState: {
        liveState: Map<string, Record<string, unknown>>;
        definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
    };
};

// Walk a built snapshot and report whether a component with `nodeId` is present.
// The renderer OMITS a component whose resolved `visible` value is false, so
// "present in the snapshot" === "visible on the rendered page".
function snapshotHasNode(snapshot: unknown, nodeId: string): boolean {
    let found = false;
    JSON.stringify(snapshot, (key, value) => {
        if (value && typeof value === "object" && (value as { id?: unknown }).id === nodeId
            && typeof (value as { kind?: unknown }).kind === "string") {
            found = true;
        }
        return value;
    });
    return found;
}

const h = new NodeBehaviourHarness("verbApp");

function registerAlert(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    const definition = h.registry["ui-alert"].mapConfig({
        id,
        parent: h.appId,
        mount: `${h.appId}.content`,
        message: "hi",
        ...extra
    });
    h.state.definitions.set(id, { nodeId: id, appId: h.appId, definition });
    return definition;
}

function registerInput(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    const definition = h.registry["ui-input"].mapConfig({
        id,
        parent: h.appId,
        mount: `${h.appId}.content`,
        label: "Field",
        ...extra
    });
    h.state.definitions.set(id, { nodeId: id, appId: h.appId, definition });
    return definition;
}

function registerStore(id: string, statePath: string, scope?: string): Record<string, unknown> {
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
// 1. ui-alert is wired into the verb system.
// ---------------------------------------------------------------------------

describe("P226: ui-alert owns the visibility verbs", () => {
    it("ui-alert is in INTERACTION_VERBS_BY_TYPE with show/hide", () => {
        expect(INTERACTION_VERBS_BY_TYPE["ui-alert"]).toEqual(expect.arrayContaining(["show", "hide"]));
    });
});

// ---------------------------------------------------------------------------
// 2. show/hide write the `visible` value (unbound → per-client slot).
// ---------------------------------------------------------------------------

describe("P226: show/hide write the unbound `visible` value (per-client slot)", () => {
    it("hide sets visible=false on the alert's per-client slot; no overlay command", () => {
        const definition = registerAlert("al");
        const client = h.connectClient("c1");
        const node = h.makeNode("ui-alert", "al", definition);

        const incoming = { ui: { clientId: "c1", action: { type: "hide" } } };
        const { sent, done } = h.drive("ui-alert", node, incoming);

        // The ONE visibility value flipped to false (not an overlay flag).
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        // No client-side overlay command was pushed for the dynamic-state verb.
        expect(client.eventsOfType("command")).toHaveLength(0);
        // The msg still passes through untouched.
        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(incoming);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("show re-sets visible=true (re-showable after a hide)", () => {
        const definition = registerAlert("al");
        h.connectClient("c1");
        const node = h.makeNode("ui-alert", "al", definition);

        h.drive("ui-alert", node, { ui: { clientId: "c1", action: { type: "hide" } } });
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);

        h.drive("ui-alert", node, { ui: { clientId: "c1", action: { type: "show" } } });
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(true);
    });

    it("per-client scoping: two clients hide the same alert independently", () => {
        const definition = registerAlert("al");
        h.connectClient("c1");
        h.connectClient("c2");
        const node = h.makeNode("ui-alert", "al", definition);

        h.drive("ui-alert", node, { ui: { clientId: "c1", action: { type: "hide" } } });
        // c2 did not act → it has no slot value (renderer falls back to visible=true).

        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        expect(wt.getClientState(h.appId, "c2")).toBeNull();
    });

    it("an explicit action.target overrides the node's own id", () => {
        registerAlert("al");
        const other = registerAlert("other");
        h.connectClient("c1");
        // Drive `other` but target `al`.
        const node = h.makeNode("ui-alert", "other", other);

        h.drive("ui-alert", node, { ui: { clientId: "c1", action: { type: "hide", target: "al" } } });

        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "other", "visible")).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 3. enable/disable write the `disabled` value.
// ---------------------------------------------------------------------------

describe("P226: enable/disable write the `disabled` value", () => {
    it("disable sets disabled=true; enable sets it back to false (per-client slot)", () => {
        const definition = registerInput("in");
        h.connectClient("c1");
        const node = h.makeNode("ui-input", "in", definition);

        h.drive("ui-input", node, { ui: { clientId: "c1", action: { type: "disable" } } });
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "in", "disabled")).toBe(true);

        h.drive("ui-input", node, { ui: { clientId: "c1", action: { type: "enable" } } });
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "in", "disabled")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 4. Bound target → store write-through (the same truth as a direct store write).
// ---------------------------------------------------------------------------

describe("P226: a store-bound `visible` is written THROUGH the store (durchgeschrieben)", () => {
    it("hide on a store-bound alert flips the STORE slice, not an internal slot", () => {
        registerStore("visStore", "vis");
        const definition = registerAlert("al", { visible: { kind: "store", path: "visStore" } });
        h.connectClient("c1");
        const node = h.makeNode("ui-alert", "al", definition);

        h.drive("ui-alert", node, { ui: { clientId: "c1", action: { type: "hide" } } });

        // The store slice changed (the single truth), not a per-client slot.
        expect(wt.getClientState(h.appId, "c1")!.state.vis).toBe(false);
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBeUndefined();

        // show writes the same store slice back to true.
        h.drive("ui-alert", node, { ui: { clientId: "c1", action: { type: "show" } } });
        expect(wt.getClientState(h.appId, "c1")!.state.vis).toBe(true);
    });

    it("a broadcast hide (no clientId) mutates the shared store slice", () => {
        registerStore("visStore", "vis");
        const definition = registerAlert("al", { visible: { kind: "store", path: "visStore" } });
        const node = h.makeNode("ui-alert", "al", definition);

        h.drive("ui-alert", node, { ui: { action: { type: "hide" } } });

        expect(wt.runtimeState.liveState.get(h.appId)!.vis).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 5. Render-level proof (ADR 0037 "Msg von außen"): a SERVER-triggered
//    (client-less) write is a BROADCAST that every viewing client observes,
//    while a per-client override still wins (isolation preserved).
//
// The render state layers as: defaults ← broadcast (shared) ← per-client. A
// component whose resolved `visible` is false is OMITTED from the snapshot, so
// "present in the snapshot" === "visible on the page".
// ---------------------------------------------------------------------------

describe("P226: broadcast dynamic-state writes reach a viewing client (per-client ?? broadcast ?? default)", () => {
    // A full app (with layout) + an unbound alert + a sibling view node, mapped the
    // way deploy does. Registers the alert so setDynamicStateField can resolve it,
    // and returns the definitions array to feed buildAppSnapshot.
    function buildRenderApp(): Record<string, unknown>[] {
        const app = h.mapConfig("ui-app", { id: h.appId, uiId: h.appId, root: h.appId, name: "A", layout: "app" });
        const alert = h.mapConfig("ui-alert", { id: "al", uiId: "al", parent: h.appId, mount: `${h.appId}.content`, message: "hi" });
        const text = h.mapConfig("ui-text", { id: "tx", uiId: "tx", parent: h.appId, mount: `${h.appId}.content`, text: "sibling" });
        h.state.definitions.set(h.appId, { nodeId: h.appId, appId: h.appId, definition: app });
        h.state.definitions.set("al", { nodeId: "al", appId: h.appId, definition: alert });
        h.state.definitions.set("tx", { nodeId: "tx", appId: h.appId, definition: text });
        return [{ ...app, z: "f" }, { ...alert, z: "f" }, { ...text, z: "f" }];
    }

    function alertVisibleFor(defs: Record<string, unknown>[], clientId?: string): boolean {
        const built = wt.buildAppSnapshot(h.appId, "/", undefined, defs, clientId);
        expect(built.success).toBe(true);
        return snapshotHasNode(built.snapshot, "al");
    }

    it("a broadcast hide hides the alert for an entry-less client; show re-shows it", () => {
        const defs = buildRenderApp();
        // Default (no writer): the unbound alert is visible (neutral true).
        expect(alertVisibleFor(defs, "browserX")).toBe(true);

        // Server-triggered hide (no clientId) → broadcast.
        wt.setDynamicStateField("al", "visible", false, undefined);
        expect(alertVisibleFor(defs, "browserX")).toBe(false);

        wt.setDynamicStateField("al", "visible", true, undefined);
        expect(alertVisibleFor(defs, "browserX")).toBe(true);
    });

    it("a client that already holds its OWN per-client state still sees a later broadcast hide", () => {
        const defs = buildRenderApp();
        // The client acquires a per-client entry BEFORE the broadcast (e.g. it set
        // some unrelated per-client dynamic-state). Its clone lacks the visible slot.
        wt.setDynamicStateField("al", "disabled", false, "browserY");
        expect(alertVisibleFor(defs, "browserY")).toBe(true);

        // A later server broadcast hide must STILL reach this client (per-client
        // slot absent for `visible` ?? broadcast false ?? default) — the stale-clone
        // no longer shadows the shared value.
        wt.setDynamicStateField("al", "visible", false, undefined);
        expect(alertVisibleFor(defs, "browserY")).toBe(false);
    });

    it("a per-client override wins over the broadcast (two-client isolation preserved)", () => {
        const defs = buildRenderApp();
        // c1 hides its OWN copy; c2 does nothing.
        wt.setDynamicStateField("al", "visible", false, "c1");
        expect(alertVisibleFor(defs, "c1")).toBe(false);
        expect(alertVisibleFor(defs, "c2")).toBe(true);

        // A broadcast SHOW does not override c1's explicit per-client hide.
        wt.setDynamicStateField("al", "visible", true, undefined);
        expect(alertVisibleFor(defs, "c1")).toBe(false); // c1's own value wins
        expect(alertVisibleFor(defs, "c2")).toBe(true);
    });
});
