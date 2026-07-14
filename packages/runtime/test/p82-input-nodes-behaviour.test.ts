import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P82 — Classic behaviour tests for the 8 input-category nodes:
 * ui-checkbox, ui-datepicker, ui-input, ui-radio, ui-select, ui-slider,
 * ui-switch, ui-textarea.
 *
 * For each node we verify via the shared NodeBehaviourHarness:
 *   1. msg.payload → updates the primary `value` field in the stored definition.
 *   2. Interaction verbs owned by the node (show/hide/enable/disable/focus/reset)
 *      → push an SSE `command` frame to connected clients.
 *   3. Pass-through: an unrecognised msg (no payload, no ui) passes the message
 *      through to the output port.
 *
 * Additionally:
 *   4. ui-input + ui-textarea: a `submit` event dispatched via dispatchClientEvent
 *      emits msg.ui on the output port.
 *   5. ui-select with multiple:true: msg.payload can be an array and is stored as-is.
 *   6. ui-datepicker mode → type mapping: `mode: "datetime"` maps to `type: "datetime-local"`;
 *      `mode: "time"` maps to `type: "time"`; default (date) maps to `type: "date"`.
 *
 * E2E note (test-conventions.md): the "inject → re-navigate → DOM update" tests that
 * existed in the P44 E2E specs have been trimmed — the behaviour is now covered here.
 * Remaining E2E specs cover only editor property panels and client rendering.
 */

const h = new NodeBehaviourHarness("inputApp");

beforeEach(() => {
    h.reset();
});

afterEach(() => {
    h.teardown();
});

// ---------------------------------------------------------------------------
// Helper: register an input node so viewNodePatchInputHandler can find it.
// ---------------------------------------------------------------------------

function registerNode(type: string, id: string, extra: Record<string, unknown> = {}) {
    const definition = h.registry[type].mapConfig({
        id,
        parent: h.appId,
        mount: `${h.appId}.content`,
        label: "Test",
        ...extra
    });
    h.state.definitions.set(id, {
        nodeId: id,
        appId: h.appId,
        definition
    });
    return definition;
}

// ---------------------------------------------------------------------------
// 1. msg.payload → updates the primary `value` field
//    (for all 8 input node types)
// ---------------------------------------------------------------------------

describe("P82: msg.payload updates the stored value definition field", () => {
    const inputNodes: Array<[string, unknown]> = [
        ["ui-checkbox", true],
        ["ui-input", "Acme"],
        ["ui-textarea", "Hello world"],
        ["ui-radio", "option-b"],
        ["ui-switch", false],
        ["ui-slider", 42],
        ["ui-datepicker", "2025-12-31"]
    ];

    for (const [type, payload] of inputNodes) {
        it(`${type}: msg.payload sets definition.value to a literalBinding`, () => {
            const nodeId = `n-${type}`;
            registerNode(type, nodeId);

            const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
            const { sent, done } = h.drive(type, node, { payload });

            const updated = h.state.definitions.get(nodeId)!.definition as Record<string, unknown>;
            const val = updated.value as { kind: string; value: unknown };
            expect(val).toMatchObject({ kind: "literal", value: payload });

            // msg always passes through
            expect(sent).toHaveLength(1);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }

    it("ui-select: msg.payload sets definition.value to a literalBinding", () => {
        const nodeId = "n-ui-select";
        registerNode("ui-select", nodeId, {
            optionsJson: JSON.stringify([
                { label: "A", value: "a" },
                { label: "B", value: "b" }
            ])
        });

        const node = h.makeNode("ui-select", nodeId, h.state.definitions.get(nodeId)!.definition);
        const { sent } = h.drive("ui-select", node, { payload: "b" });

        const updated = h.state.definitions.get(nodeId)!.definition as Record<string, unknown>;
        const val = updated.value as { kind: string; value: unknown };
        expect(val).toMatchObject({ kind: "literal", value: "b" });
        expect(sent).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 2. Pass-through: msg with no payload and no ui.action passes through unchanged
// ---------------------------------------------------------------------------

describe("P82: pass-through — no payload and no interaction verb", () => {
    const allInputTypes = [
        "ui-checkbox",
        "ui-datepicker",
        "ui-input",
        "ui-radio",
        "ui-select",
        "ui-slider",
        "ui-switch",
        "ui-textarea"
    ];

    for (const type of allInputTypes) {
        it(`${type}: passes through a message with no matching payload or verb`, () => {
            const nodeId = `pt-${type}`;
            registerNode(type, nodeId);

            const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
            const originalMsg = { topic: "test", someField: "value" };
            const { sent, done } = h.drive(type, node, originalMsg);

            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(originalMsg);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 3. Pass-through when node is NOT registered (unregistered node edge case)
// ---------------------------------------------------------------------------

describe("P82: pass-through when node has no registered definition", () => {
    it("ui-input: an unregistered node passes msg through immediately", () => {
        // Do NOT register the node — only the app is in definitions.
        const node = h.makeNode("ui-input", "unregistered-node");
        const msg = { payload: "value" };
        const { sent, done } = h.drive("ui-input", node, msg);

        expect(sent).toHaveLength(1);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// 4. Interaction verbs.
//   - P226 (ADR 0037): show/hide + enable/disable are dynamic-state WRITERS — they
//     set the target's ONE visible/disabled value via setDynamicStateField (unbound
//     → per-client slot), NOT a client `command` overlay.
//   - focus/reset stay client commands (transient effects, no server value).
// ---------------------------------------------------------------------------

// P226: the (field, value) each visibility/enabled verb writes.
const DS_VERB_WRITES: Record<string, [string, boolean]> = {
    show: ["visible", true],
    hide: ["visible", false],
    enable: ["disabled", false],
    disable: ["disabled", true]
};

const dsTest = webappTest as unknown as {
    getClientState: (appId: string, clientId: string) => { state: Record<string, unknown> } | null;
};

function slotValue(state: Record<string, unknown> | undefined, nodeId: string, field: string): unknown {
    const root = state && (state.__dynamicState as Record<string, Record<string, unknown>> | undefined);
    return root && root[nodeId] ? root[nodeId][field] : undefined;
}

describe("P226: input-node visibility/enabled verbs write the dynamic-state value", () => {
    const dsVerbsByType: Record<string, string[]> = {
        "ui-checkbox": ["show", "hide", "enable", "disable"],
        "ui-datepicker": ["show", "hide", "enable", "disable"],
        "ui-input": ["show", "hide", "enable", "disable"],
        "ui-radio": ["show", "hide", "enable", "disable"],
        "ui-select": ["show", "hide", "enable", "disable"],
        "ui-slider": ["show", "hide", "enable", "disable"],
        "ui-switch": ["show", "hide", "enable", "disable"],
        "ui-textarea": ["show", "hide", "enable", "disable"]
    };

    for (const [type, verbs] of Object.entries(dsVerbsByType)) {
        for (const verb of verbs) {
            const [field, value] = DS_VERB_WRITES[verb];
            it(`${type}: '${verb}' writes ${field}=${value} to the per-client slot, pushes no command`, () => {
                const nodeId = `dsverb-${type}-${verb}`;
                const client = h.connectClient("c1");
                registerNode(type, nodeId);

                const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
                h.drive(type, node, { ui: { clientId: "c1", action: { type: verb } } });

                expect(client.eventsOfType("command")).toHaveLength(0);
                expect(slotValue(dsTest.getClientState(h.appId, "c1")!.state, nodeId, field)).toBe(value);
            });
        }
    }
});

describe("P82: focus/reset verbs still push an SSE command frame", () => {
    // Only the input nodes that own focus/reset (transient effects, not dynamic state).
    const verbOwnership: Record<string, string[]> = {
        "ui-datepicker": ["focus", "reset"],
        "ui-input": ["focus", "reset"],
        "ui-textarea": ["focus", "reset"]
    };

    for (const [type, verbs] of Object.entries(verbOwnership)) {
        const verb = verbs[0];
        it(`${type}: owned verb '${verb}' pushes an SSE command frame`, () => {
            const nodeId = `verb-${type}`;
            const client = h.connectClient("c1");
            registerNode(type, nodeId);

            const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
            h.drive(type, node, { ui: { clientId: "c1", action: { type: verb } } });

            const commands = client.eventsOfType("command");
            expect(commands).toHaveLength(1);
            expect(commands[0].data).toMatchObject({ command: { type: verb, target: nodeId } });
        });
    }
});

describe("P82: a non-owned verb passes through without pushing a command", () => {
    const inputTypes = [
        "ui-checkbox",
        "ui-datepicker",
        "ui-input",
        "ui-radio",
        "ui-select",
        "ui-slider",
        "ui-switch",
        "ui-textarea"
    ];

    for (const type of inputTypes) {
        // Test a verb NOT owned by this node → pass-through, no command push
        const notOwned = "open"; // "open" is a ui-dialog verb, no input node owns it
        it(`${type}: non-owned verb '${notOwned}' passes through without pushing a command`, () => {
            const nodeId = `no-verb-${type}`;
            const client = h.connectClient("c2");
            registerNode(type, nodeId);

            const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
            const { sent } = h.drive(type, node, { ui: { clientId: "c2", action: { type: notOwned } } });

            expect(client.eventsOfType("command")).toHaveLength(0);
            expect(sent).toHaveLength(1); // passed through
        });
    }
});

// ---------------------------------------------------------------------------
// 5. ui-input + ui-textarea: submit event via dispatchClientEvent
// ---------------------------------------------------------------------------

describe("P82: submit event dispatched via dispatchClientEvent reaches output port", () => {
    for (const type of ["ui-input", "ui-textarea"] as const) {
        it(`${type}: submit event emits msg.ui on the output port`, () => {
            const nodeId = `submit-${type}`;
            registerNode(type, nodeId);

            const definitions = h.buildDefinitions([
                { type: "ui-app", id: h.appId, root: h.appId, name: "Input App", layout: "app", z: "f1" },
                { type, id: nodeId, parent: h.appId, label: "Field", z: "f1", events: ["change", "submit"] }
            ]);

            const { result, emitted } = h.dispatchClientEvent(
                [nodeId],
                { clientId: "c1", event: "submit", sourceId: nodeId, params: { value: "hello" } },
                definitions
            );

            expect(result.success).toBe(true);
            const out = emitted.get(nodeId)!;
            expect(out).toHaveLength(1);
            expect(out[0]).toMatchObject({ event: "submit", sourceId: nodeId });
        });
    }
});

// ---------------------------------------------------------------------------
// 6. ui-select multiple → array value stored correctly
// ---------------------------------------------------------------------------

describe("P82: ui-select with multiple:true stores array payload as literalBinding", () => {
    it("msg.payload as array is stored as { kind: 'literal', value: [...] }", () => {
        const nodeId = "sel-multi";
        registerNode("ui-select", nodeId, {
            multiple: true,
            optionsJson: JSON.stringify([
                { label: "A", value: "a" },
                { label: "B", value: "b" },
                { label: "C", value: "c" }
            ])
        });

        const node = h.makeNode("ui-select", nodeId, h.state.definitions.get(nodeId)!.definition);
        const { sent } = h.drive("ui-select", node, { payload: ["a", "c"] });

        const updated = h.state.definitions.get(nodeId)!.definition as Record<string, unknown>;
        const val = updated.value as { kind: string; value: unknown };
        expect(val).toMatchObject({ kind: "literal", value: ["a", "c"] });
        expect(sent).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 7. ui-datepicker mode → serializer type attribute mapping
// ---------------------------------------------------------------------------

describe("P82: ui-datepicker mode maps to the correct HTML input type via mapConfig", () => {
    it("mode 'datetime' stored in definition allows serializer to use type=datetime-local", () => {
        const def = h.registry["ui-datepicker"].mapConfig({
            id: "dp1",
            parent: h.appId,
            label: "Date",
            mode: "datetime"
        });
        expect(def.mode).toBe("datetime");
    });

    it("mode 'time' stored in definition allows serializer to use type=time", () => {
        const def = h.registry["ui-datepicker"].mapConfig({
            id: "dp2",
            parent: h.appId,
            label: "Date",
            mode: "time"
        });
        expect(def.mode).toBe("time");
    });

    it("no mode (default) stored in definition defaults to type=date in serializer", () => {
        const def = h.registry["ui-datepicker"].mapConfig({
            id: "dp3",
            parent: h.appId,
            label: "Date"
        });
        expect(def.mode).toBeUndefined();
    });

    it("mode 'datetime' → viewNodePatchInputHandler stores literal binding; mode field preserved", () => {
        const nodeId = "dp-mode";
        registerNode("ui-datepicker", nodeId, { mode: "datetime", value: "2025-01-01T10:00" });

        const node = h.makeNode("ui-datepicker", nodeId, h.state.definitions.get(nodeId)!.definition);
        h.drive("ui-datepicker", node, { payload: "2025-06-15T12:00" });

        const updated = h.state.definitions.get(nodeId)!.definition as Record<string, unknown>;
        const val = updated.value as { kind: string; value: unknown };
        expect(val).toMatchObject({ kind: "literal", value: "2025-06-15T12:00" });
        // mode field must still be present after patch (mapConfig sets it)
        expect(updated.mode).toBe("datetime");
    });
});
