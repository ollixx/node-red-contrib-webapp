import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P223 (ADR 0036) — Message mode drives EVERY msg-bound field of a view node,
 * not only its primary field.
 *
 * The owner's bug: `ui-alert.visible = msg.<prop>` was inert — the runtime push
 * (`viewNodePatchInputHandler`) updated ONLY VIEW_NODE_PRIMARY_FIELD (ui-alert →
 * `message`), so a `msg`-bound `visible` was never read, and the live-patch merge
 * never carried `visible` into the pushed snapshot.
 *
 * This suite pins:
 *   1. a non-primary `msg`-bound field (`visible`) updates from its OWN prop;
 *   2. boolean coercion for visible/disabled (true/false + "true"/"false");
 *   3. multiple msg-bound fields on one node, each from its own path;
 *   4. a JSONata-bound non-primary field is evaluated against the incoming msg;
 *   5. primary-field + legacy bare-payload back-compat is preserved;
 *   6. the live-patch merge (computeLiveViewPatch) carries visible/disabled.
 */

const collectBoundViewFields = webappTest.collectBoundViewFields as (
    def: Record<string, unknown>,
    kind: string
) => Array<{ field: string; path: string }>;
const coerceViewBoolean = webappTest.coerceViewBoolean as (v: unknown) => boolean;
const computeLiveViewPatch = webappTest.computeLiveViewPatch as (
    base: Record<string, unknown>,
    live: Record<string, unknown>
) => Record<string, unknown>;

const h = new NodeBehaviourHarness("msgFieldApp");

function registerNode(type: string, id: string, extra: Record<string, unknown> = {}) {
    const definition = h.registry[type].mapConfig({
        id,
        parent: h.appId,
        mount: `${h.appId}.content`,
        ...extra
    });
    h.state.definitions.set(id, { nodeId: id, appId: h.appId, definition });
    return definition;
}

function drive(type: string, id: string, msg: Record<string, unknown>) {
    const node = h.makeNode(type, id, h.state.definitions.get(id)!.definition);
    return h.drive(type, node, msg);
}

function liveDef(id: string) {
    return h.state.definitions.get(id)!.definition as Record<string, unknown>;
}

beforeEach(() => h.reset());
afterEach(() => h.teardown());

// ---------------------------------------------------------------------------
// 1. Non-primary msg-bound field: ui-alert.visible = msg.visible
// ---------------------------------------------------------------------------

describe("P223: a non-primary msg-bound field updates from its own message prop", () => {
    it("ui-alert.visible = msg.visible → true shows (literal true binding)", () => {
        registerNode("ui-alert", "a1", { message: "Hi", visible: { kind: "msg", path: "visible" } });

        const { sent, done } = drive("ui-alert", "a1", { visible: true });

        expect(liveDef("a1").visible).toEqual({ kind: "literal", value: true });
        expect(sent).toHaveLength(1);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("ui-alert.visible = msg.visible → false hides (literal false binding)", () => {
        registerNode("ui-alert", "a2", { message: "Hi", visible: { kind: "msg", path: "visible" } });

        drive("ui-alert", "a2", { visible: false });

        expect(liveDef("a2").visible).toEqual({ kind: "literal", value: false });
    });

    it("reads from a custom path (msg.show), not payload", () => {
        registerNode("ui-alert", "a3", { message: "Hi", visible: { kind: "msg", path: "show" } });

        drive("ui-alert", "a3", { show: true, payload: "ignored" });

        expect(liveDef("a3").visible).toEqual({ kind: "literal", value: true });
    });

    it("a missing message prop leaves the field untouched (no crash)", () => {
        registerNode("ui-alert", "a4", { message: "Hi", visible: { kind: "msg", path: "visible" } });

        const { sent } = drive("ui-alert", "a4", { topic: "unrelated" });

        // visible binding still the original msg binding (not overwritten to literal).
        expect(liveDef("a4").visible).toEqual({ kind: "msg", path: "visible" });
        expect(sent).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 2. Boolean coercion
// ---------------------------------------------------------------------------

describe("P223: boolean coercion for visible/disabled", () => {
    it("coerceViewBoolean handles booleans and the true/false strings", () => {
        expect(coerceViewBoolean(true)).toBe(true);
        expect(coerceViewBoolean(false)).toBe(false);
        expect(coerceViewBoolean("true")).toBe(true);
        expect(coerceViewBoolean("false")).toBe(false);
        expect(coerceViewBoolean("TRUE")).toBe(true);
        expect(coerceViewBoolean(" false ")).toBe(false);
        expect(coerceViewBoolean(1)).toBe(true);
        expect(coerceViewBoolean(0)).toBe(false);
    });

    it('the string "false" coerces to a literal false (not truthy)', () => {
        registerNode("ui-alert", "b1", { message: "Hi", visible: { kind: "msg", path: "visible" } });

        drive("ui-alert", "b1", { visible: "false" });

        expect(liveDef("b1").visible).toEqual({ kind: "literal", value: false });
    });

    it('the string "true" coerces to a literal true', () => {
        registerNode("ui-alert", "b2", { message: "Hi", visible: { kind: "msg", path: "visible" } });

        drive("ui-alert", "b2", { visible: "true" });

        expect(liveDef("b2").visible).toEqual({ kind: "literal", value: true });
    });

    it("ui-input.disabled = msg.disabled coerces to a literal boolean", () => {
        // ui-input routes through interactionInputHandler → viewNodePatchInputHandler
        // (no verb → delegate). A bare {disabled} message updates the base field.
        registerNode("ui-input", "b3", { label: "Name", disabled: { kind: "msg", path: "disabled" } });

        drive("ui-input", "b3", { disabled: "true" });

        expect(liveDef("b3").disabled).toEqual({ kind: "literal", value: true });
    });
});

// ---------------------------------------------------------------------------
// 3. Multiple msg-bound fields on one node, each from its own path
// ---------------------------------------------------------------------------

describe("P223: multiple msg-bound fields, each from its own path", () => {
    it("ui-alert message + visible both update from their own props in one message", () => {
        registerNode("ui-alert", "m1", {
            message: { kind: "msg", path: "text" },
            visible: { kind: "msg", path: "show" }
        });

        drive("ui-alert", "m1", { text: "Disk full", show: true });

        expect(liveDef("m1").message).toEqual({ kind: "literal", value: "Disk full" });
        expect(liveDef("m1").visible).toEqual({ kind: "literal", value: true });
    });

    it("collectBoundViewFields finds every msg binding (not only the primary)", () => {
        const def = {
            type: "ui-alert",
            id: "x",
            message: { kind: "msg", path: "text" },
            visible: { kind: "msg", path: "show" },
            severity: "info"
        };
        const found = collectBoundViewFields(def, "msg").sort((a, b) => a.field.localeCompare(b.field));
        expect(found).toEqual([
            { field: "message", path: "text" },
            { field: "visible", path: "show" }
        ]);
    });

    it("a msg binding with no path defaults to payload", () => {
        const def = { type: "ui-text", id: "x", value: { kind: "msg" } };
        expect(collectBoundViewFields(def, "msg")).toEqual([{ field: "value", path: "payload" }]);
    });
});

// ---------------------------------------------------------------------------
// 4. JSONata-bound non-primary field
// ---------------------------------------------------------------------------

describe("P223: a JSONata-bound non-primary field is evaluated against the msg", () => {
    // A minimal JSONata engine mock: the "expression" is a dotted msg path; the
    // async callback form (Node-RED v3+) is respected.
    function jsonataRED() {
        return {
            nodes: { getNode: () => undefined },
            util: {
                prepareJSONataExpression: (src: string) => ({ src }),
                evaluateJSONataExpression: (
                    expr: { src: string },
                    msg: Record<string, unknown>,
                    cb: (err: unknown, result: unknown) => void
                ) => {
                    const result = expr.src
                        .split(".")
                        .reduce<unknown>((acc, seg) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[seg] : undefined), msg);
                    // async-only, like the real Node-RED v3 engine
                    setImmediate(() => cb(null, result));
                }
            }
        };
    }

    it("ui-alert.visible = jsonata evaluates and toggles (boolean-coerced literal)", async () => {
        h.setRED(jsonataRED());
        registerNode("ui-alert", "j1", { message: "Hi", visible: { kind: "jsonata", path: "payload.show" } });

        const node = h.makeNode("ui-alert", "j1", liveDef("j1"));
        const send = vi.fn();
        const done = vi.fn();
        h.registry["ui-alert"].options.inputHandler(node, { payload: { show: true } }, send, done);

        // async: wait for the JSONata callback + single finish().
        await vi.waitFor(() => expect(done).toHaveBeenCalledTimes(1));
        expect(liveDef("j1").visible).toEqual({ kind: "literal", value: true });
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("a JSONata primary field (ui-text.value) still resolves via the async path", async () => {
        h.setRED(jsonataRED());
        registerNode("ui-text", "j2", { value: { kind: "jsonata", path: "payload.name" } });

        const node = h.makeNode("ui-text", "j2", liveDef("j2"));
        const send = vi.fn();
        const done = vi.fn();
        h.registry["ui-text"].options.inputHandler(node, { payload: { name: "Ada" } }, send, done);

        await vi.waitFor(() => expect(done).toHaveBeenCalledTimes(1));
        expect(liveDef("j2").value).toEqual({ kind: "literal", value: "Ada" });
    });
});

// ---------------------------------------------------------------------------
// 5. Back-compat: legacy bare-payload updates the primary field
// ---------------------------------------------------------------------------

describe("P223: legacy bare-payload → primary field is preserved", () => {
    it("ui-text with no msg binding: msg.payload updates value", () => {
        registerNode("ui-text", "c1", { text: "Initial" });

        drive("ui-text", "c1", { payload: "Hello" });

        expect(liveDef("c1").value).toEqual({ kind: "literal", value: "Hello" });
    });

    it("ui-button label (non-binding primary) stays a raw string", () => {
        registerNode("ui-button", "c2", { label: "Old" });

        drive("ui-button", "c2", { payload: "New" });

        expect(liveDef("c2").label).toEqual("New");
    });

    it("when the primary field IS msg-bound, a bare payload does NOT double-update it", () => {
        registerNode("ui-text", "c3", { value: { kind: "msg", path: "text" } });

        drive("ui-text", "c3", { text: "fromPath", payload: "fromPayload" });

        // read from the configured path, not the bare payload.
        expect(liveDef("c3").value).toEqual({ kind: "literal", value: "fromPath" });
    });
});

// ---------------------------------------------------------------------------
// 6. Live-patch merge carries visible/disabled
// ---------------------------------------------------------------------------

describe("P223: computeLiveViewPatch carries visible/disabled", () => {
    it("carries a runtime-updated visible into the patch", () => {
        const base = { type: "ui-alert", id: "p1", visible: { kind: "msg", path: "visible" } };
        const live = { ...base, visible: { kind: "literal", value: false } };
        expect(computeLiveViewPatch(base, live)).toEqual({ visible: { kind: "literal", value: false } });
    });

    it("carries a runtime-updated disabled into the patch", () => {
        const base = { type: "ui-button", id: "p2", disabled: { kind: "msg", path: "disabled" } };
        const live = { ...base, disabled: { kind: "literal", value: true } };
        expect(computeLiveViewPatch(base, live)).toEqual({ disabled: { kind: "literal", value: true } });
    });

    it("no change → empty patch", () => {
        const base = { type: "ui-alert", id: "p3", visible: { kind: "literal", value: true }, message: { kind: "literal", value: "x" } };
        expect(computeLiveViewPatch(base, { ...base })).toEqual({});
    });

    it("still carries the existing binding fields (value/rows/items/src/message)", () => {
        const base = { type: "ui-text", id: "p4", value: { kind: "literal", value: "a" } };
        const live = { ...base, value: { kind: "literal", value: "b" } };
        expect(computeLiveViewPatch(base, live)).toEqual({ value: { kind: "literal", value: "b" } });
    });
});
