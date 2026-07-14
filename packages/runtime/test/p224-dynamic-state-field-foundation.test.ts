import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P224 (ADR 0037) — Dynamic-State-Field Foundation.
 *
 * ONE resolved value per component for the bindable dynamic-state fields
 * (`visible`/`disabled`):
 *   - UNBOUND (literal/none) → an INTERNAL per-client slot on the node
 *     (`__dynamicState.<id>.<field>` in the same per-client state tree as
 *     ui-store, P201). `setDynamicStateField` writes it; two clients are isolated.
 *   - BOUND to a store → `setDynamicStateField` writes THROUGH into the store
 *     slice (scope-correct), keeping the store the single truth.
 * The compiled component reads exactly one value: `toComponentDefinitions`
 * rewrites an UNBOUND visible/disabled to a `state` binding at the slot path
 * (with the configured-literal-or-neutral value as the fallback); a bound one is
 * left reactive from its source.
 */

// The webapp __test__ surface exposes the P224 helpers; type them loosely here.
const wt = webappTest as unknown as {
    setDynamicStateField: (
        nodeId: string,
        field: string,
        value: unknown,
        clientId?: string
    ) => { ok: boolean; mode?: string; reason?: string; clientId?: string };
    toComponentDefinitions: (components: Record<string, unknown>[]) => Record<string, unknown>[];
    dynamicStateSlotPath: (nodeId: string, field: string) => string;
    getClientState: (appId: string, clientId: string) => { state: Record<string, unknown> } | null;
    runtimeState: {
        liveState: Map<string, Record<string, unknown>>;
        definitions: Map<string, { nodeId: string; appId?: string; definition: Record<string, unknown> }>;
    };
};

const h = new NodeBehaviourHarness("dynApp");

function registerAlert(id: string, extra: Record<string, unknown> = {}) {
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

function registerStore(id: string, statePath: string, scope?: string) {
    const definition = h.registry["ui-store"].mapConfig({ id, statePath, ...(scope ? { scope } : {}) });
    h.state.definitions.set(id, { nodeId: id, appId: h.appId, definition });
    return definition;
}

// The slot value the renderer would read for (nodeId, field) from a state tree.
function slotValue(state: Record<string, unknown> | undefined, nodeId: string, field: string): unknown {
    const root = state && (state.__dynamicState as Record<string, Record<string, unknown>> | undefined);
    return root && root[nodeId] ? root[nodeId][field] : undefined;
}

beforeEach(() => h.reset());
afterEach(() => h.teardown());

// ---------------------------------------------------------------------------
// 1. Compiled component: unbound → slot binding, bound → reactive source
// ---------------------------------------------------------------------------

describe("P224: toComponentDefinitions normalises unbound dynamic-state fields", () => {
    it("an absent visible becomes a slot state-binding with neutral fallback true", () => {
        const [c] = wt.toComponentDefinitions([
            { type: "ui-alert", id: "al", mount: "route:/x/content", message: "hi" }
        ]);
        expect(c.visibleIf).toEqual({
            kind: "state",
            path: wt.dynamicStateSlotPath("al", "visible"),
            fallback: true
        });
    });

    it("a configured literal visible=false becomes the slot fallback (back-compat)", () => {
        const [c] = wt.toComponentDefinitions([
            {
                type: "ui-alert",
                id: "al",
                mount: "route:/x/content",
                message: "hi",
                visible: { kind: "literal", value: false }
            }
        ]);
        expect(c.visibleIf).toEqual({
            kind: "state",
            path: wt.dynamicStateSlotPath("al", "visible"),
            fallback: false
        });
    });

    it("a BOUND (store) visible is left reactive from its source, untouched", () => {
        const [c] = wt.toComponentDefinitions([
            {
                type: "ui-alert",
                id: "al",
                mount: "route:/x/content",
                message: "hi",
                visible: { kind: "store", path: "visStore" }
            }
        ]);
        expect(c.visibleIf).toEqual({ kind: "store", path: "visStore" });
    });

    it("a msg-bound visible is LEFT untouched (P223 semantics: hidden until a message)", () => {
        // msg/jsonata/flow/global/env are NOT slot-backed — their own writer
        // slices drive them, and they must not default to the neutral slot value.
        const [c] = wt.toComponentDefinitions([
            {
                type: "ui-alert",
                id: "al",
                mount: "route:/x/content",
                message: "hi",
                visible: { kind: "msg", path: "payload" }
            }
        ]);
        expect(c.visibleIf).toEqual({ kind: "msg", path: "payload" });
    });

    it("an unbound disabled (present) becomes a slot state-binding with neutral fallback false", () => {
        const [c] = wt.toComponentDefinitions([
            {
                type: "ui-input",
                id: "in",
                mount: "route:/x/content",
                disabled: { kind: "literal", value: false }
            }
        ]);
        const bind = c.bind as Record<string, unknown>;
        expect(bind.disabled).toEqual({
            kind: "state",
            path: wt.dynamicStateSlotPath("in", "disabled"),
            fallback: false
        });
    });
});

// ---------------------------------------------------------------------------
// 2. setDynamicStateField — UNBOUND writes the internal per-client slot
// ---------------------------------------------------------------------------

describe("P224: setDynamicStateField writes the internal per-client slot (unbound)", () => {
    it("writes visible into the client's slot; default (no writer) is neutral/absent", () => {
        registerAlert("al");

        // No writer yet → the client has no slot value (renderer falls back to neutral).
        expect(wt.getClientState(h.appId, "c1")).toBeNull();

        const res = wt.setDynamicStateField("al", "visible", false, "c1");
        expect(res).toMatchObject({ ok: true, mode: "slot", clientId: "c1" });

        const state = wt.getClientState(h.appId, "c1")!.state;
        expect(slotValue(state, "al", "visible")).toBe(false);
    });

    it('coerces the "true"/"false" strings to booleans', () => {
        registerAlert("al");
        wt.setDynamicStateField("al", "visible", "false", "c1");
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        wt.setDynamicStateField("al", "visible", "true", "c1");
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(true);
    });

    it("two clients have INDEPENDENT unbound visibility (per-client isolation)", () => {
        registerAlert("al");

        wt.setDynamicStateField("al", "visible", false, "c1");
        wt.setDynamicStateField("al", "visible", true, "c2");

        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        expect(slotValue(wt.getClientState(h.appId, "c2")!.state, "al", "visible")).toBe(true);
    });

    it("a broadcast write (no clientId) lands in the shared/broadcast state", () => {
        registerAlert("al");
        const res = wt.setDynamicStateField("al", "visible", false);
        expect(res).toMatchObject({ ok: true, mode: "slot" });
        expect(slotValue(wt.runtimeState.liveState.get(h.appId), "al", "visible")).toBe(false);
        // no per-client slot was created
        expect(wt.getClientState(h.appId, "c1")).toBeNull();
    });

    it("disabled writes its own slot, independently of visible", () => {
        registerAlert("al");
        wt.setDynamicStateField("al", "disabled", true, "c1");
        const state = wt.getClientState(h.appId, "c1")!.state;
        expect(slotValue(state, "al", "disabled")).toBe(true);
        expect(slotValue(state, "al", "visible")).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 3. setDynamicStateField — BOUND writes THROUGH to the store slice
// ---------------------------------------------------------------------------

describe("P224: setDynamicStateField writes through to a bound store", () => {
    it("a store-bound visible writes the store slice per-client (scope-correct)", () => {
        registerStore("visStore", "vis");
        registerAlert("al", { visible: { kind: "store", path: "visStore" } });

        const res = wt.setDynamicStateField("al", "visible", false, "c1");
        expect(res).toMatchObject({ ok: true, mode: "store", clientId: "c1" });

        // The STORE slice changed (durchgeschrieben), NOT an internal slot.
        expect(wt.getClientState(h.appId, "c1")!.state.vis).toBe(false);
        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBeUndefined();
    });

    it("a broadcast store write mutates the shared store slice", () => {
        registerStore("visStore", "vis");
        registerAlert("al", { visible: { kind: "store", path: "visStore" } });

        wt.setDynamicStateField("al", "visible", true);
        expect(wt.runtimeState.liveState.get(h.appId)!.vis).toBe(true);
    });

    it("honours a client-only store's scope guard (broadcast refused)", () => {
        registerStore("visStore", "vis", "client-only");
        registerAlert("al", { visible: { kind: "store", path: "visStore" } });

        const refused = wt.setDynamicStateField("al", "visible", false);
        expect(refused).toMatchObject({ ok: false, reason: "scope-violation" });

        const ok = wt.setDynamicStateField("al", "visible", false, "c1");
        expect(ok.ok).toBe(true);
        expect(wt.getClientState(h.appId, "c1")!.state.vis).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 3b. The flow-reachable seam: msg.ui.dynamicState → setDynamicStateField
// ---------------------------------------------------------------------------

describe("P224: msg.ui.dynamicState drives the write API (per-client)", () => {
    it("an incoming msg.ui.dynamicState writes THIS node's slot for its clientId", () => {
        const definition = registerAlert("al");
        const node = h.makeNode("ui-alert", "al", definition);
        const { sent, done } = h.drive("ui-alert", node, {
            ui: { clientId: "c1", dynamicState: { field: "visible", value: false } }
        });

        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        // the spent command is stripped before the msg passes through
        const out = sent[0] as { ui: Record<string, unknown> };
        expect(out.ui.dynamicState).toBeUndefined();
        expect(out.ui.clientId).toBe("c1");
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("an explicit id targets another node; two clients stay isolated", () => {
        registerAlert("al");
        const other = registerAlert("other");
        const node = h.makeNode("ui-alert", "other", other);

        h.drive("ui-alert", node, {
            ui: { clientId: "c1", dynamicState: { field: "visible", value: false, id: "al" } }
        });
        h.drive("ui-alert", node, {
            ui: { clientId: "c2", dynamicState: { field: "visible", value: true, id: "al" } }
        });

        expect(slotValue(wt.getClientState(h.appId, "c1")!.state, "al", "visible")).toBe(false);
        expect(slotValue(wt.getClientState(h.appId, "c2")!.state, "al", "visible")).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 4. Guards
// ---------------------------------------------------------------------------

describe("P224: setDynamicStateField guards", () => {
    it("rejects a non-dynamic-state field", () => {
        registerAlert("al");
        expect(wt.setDynamicStateField("al", "color", "red", "c1")).toMatchObject({
            ok: false,
            reason: "not-a-dynamic-state-field"
        });
    });

    it("rejects an unknown node", () => {
        expect(wt.setDynamicStateField("nope", "visible", true, "c1")).toMatchObject({
            ok: false,
            reason: "unknown-node"
        });
    });

    it("refuses a read-only computed source (query/routeParam/reactive)", () => {
        registerAlert("al", { visible: { kind: "reactive", value: "1 > 0" } });
        expect(wt.setDynamicStateField("al", "visible", false, "c1")).toMatchObject({
            ok: false,
            reason: "read-only-bound"
        });
    });
});
