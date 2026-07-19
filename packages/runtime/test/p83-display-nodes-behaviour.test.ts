import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P83 — Classic behaviour tests for the display-category nodes:
 * ui-text, ui-button, ui-table, ui-container, ui-avatar, ui-image, ui-icon, ui-list.
 * (ui-divider is excluded: it has no input port / handler — covered by P76.)
 *
 * For each node we verify via the shared NodeBehaviourHarness:
 *   1. msg.payload → updates the primary field in the stored definition and pushes
 *      a snapshot to connected clients.
 *   2. Interaction verbs owned by the node (show/hide/enable/disable) push an SSE
 *      `command` frame and pass the msg through.
 *   3. Pass-through: an unrecognised msg (no payload, no ui.action) passes the
 *      message through to the output port unchanged.
 *
 * Additionally:
 *   4. ui-button: msg with a `click`-like ui.event emits the click msg on port 0;
 *      msg.payload updates the `label` field.
 *   5. ui-table: the rowSelect event dispatched via dispatchClientEvent emits
 *      msg.ui on the table node's output port.
 *   6. ui-list: itemClick event dispatched via dispatchClientEvent emits msg.ui.
 *   7. ui-icon: uses componentStateInputHandler — passes all messages through.
 *
 * E2E note (test-conventions.md): the "inject → re-navigate → DOM update" behaviour
 * is fully covered by these classic tests. Remaining E2E specs cover only editor
 * property panels and client rendering (ui-icon, ui-divider render E2E added in P83).
 */

const h = new NodeBehaviourHarness("displayApp");

beforeEach(() => {
    h.reset();
});

afterEach(() => {
    h.teardown();
});

// ---------------------------------------------------------------------------
// Helper: register a display node definition so viewNodePatchInputHandler can find it.
// ---------------------------------------------------------------------------

function registerNode(type: string, id: string, extra: Record<string, unknown> = {}) {
    const definition = h.registry[type].mapConfig({
        id,
        parent: h.appId,
        mount: `${h.appId}.content`,
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
// 1. msg.payload → updates the primary field (viewNodePatchInputHandler nodes)
// ---------------------------------------------------------------------------

describe("P83: msg.payload updates the stored primary field", () => {
    // Each entry: [nodeType, payloadValue, primaryField, extra config]
    const cases: Array<[string, unknown, string, Record<string, unknown>]> = [
        ["ui-text", "Hello world", "value", { text: "Initial" }],
        ["ui-button", "Click me", "label", { label: "Old label" }],
        ["ui-table", [{ id: 1, name: "Row" }], "rows", {}],
        ["ui-image", "https://example.com/img.png", "src", {}],
        ["ui-avatar", "https://example.com/avatar.png", "src", {}],
        ["ui-list", [{ id: "a", label: "Item A" }], "items", {}]
    ];

    for (const [type, payload, field, extra] of cases) {
        it(`${type}: msg.payload sets definition.${field}`, () => {
            const nodeId = `n-${type}`;
            registerNode(type, nodeId, extra);

            const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
            const { sent, done } = h.drive(type, node, { payload });

            const updated = h.state.definitions.get(nodeId)!.definition as Record<string, unknown>;
            // Fields in VIEW_NODE_BINDING_FIELDS are wrapped as literalBinding; others are raw.
            const BINDING_FIELDS = new Set(["value", "src", "rows", "items"]);
            if (BINDING_FIELDS.has(field)) {
                const val = updated[field] as { kind: string; value: unknown };
                expect(val).toMatchObject({ kind: "literal", value: payload });
            } else {
                // label and similar are stored directly
                expect(updated[field]).toEqual(payload);
            }

            // msg always passes through
            expect(sent).toHaveLength(1);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 2. Pass-through — no payload, no interaction verb
// ---------------------------------------------------------------------------

describe("P83: pass-through — no payload and no interaction verb", () => {
    // Note: ui-button is intentionally excluded — its handler converts any
    // non-payload, non-component-op message into a click event (by design).
    const displayTypes = [
        "ui-text",
        "ui-table",
        "ui-image",
        "ui-avatar",
        "ui-list"
    ];

    for (const type of displayTypes) {
        it(`${type}: passes through a message with no matching payload or verb`, () => {
            const nodeId = `pt-${type}`;
            registerNode(type, nodeId, { label: "Test", text: "Test" });

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
// 3. Pass-through when node is NOT registered
// ---------------------------------------------------------------------------

describe("P83: pass-through when node has no registered definition", () => {
    it("ui-text: an unregistered node passes msg through immediately", () => {
        const node = h.makeNode("ui-text", "unregistered-text");
        const msg = { payload: "Hello" };
        const { sent, done } = h.drive("ui-text", node, msg);

        expect(sent).toHaveLength(1);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// 4. Interaction verbs owned by display nodes.
//   - P226 (ADR 0037): the VISIBILITY / ENABLED verbs (show/hide/enable/disable)
//     are dynamic-state WRITERS — they set the target's ONE visible/disabled value
//     through setDynamicStateField (unbound → per-client slot), NOT a client
//     overlay `command`. No `command` frame is pushed for them.
//   - Other owned verbs (select, …) still push an SSE `command` frame.
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

describe("P226: visibility/enabled verbs write the dynamic-state value (no overlay command)", () => {
    const verbOwnership: Record<string, string[]> = {
        "ui-text": ["show", "hide"],
        "ui-button": ["show", "hide", "enable", "disable"],
        "ui-table": ["show", "hide"],
        "ui-container": ["show", "hide"]
    };

    for (const [type, verbs] of Object.entries(verbOwnership)) {
        for (const verb of verbs) {
            const [field, value] = DS_VERB_WRITES[verb];
            it(`${type}: '${verb}' writes ${field}=${value} to the per-client slot and pushes no command`, () => {
                const nodeId = `dsverb-${type}-${verb}`;
                const client = h.connectClient("c1");

                if (type === "ui-container") {
                    // setDynamicStateField needs the node registered; a bare
                    // definition is enough (an unbound visible/disabled → slot).
                    h.state.definitions.set(nodeId, { nodeId, appId: h.appId, definition: { type, id: nodeId } });
                    const node = h.makeNode(type, nodeId);
                    h.drive(type, node, { ui: { clientId: "c1", action: { type: verb } } });
                } else {
                    registerNode(type, nodeId, { label: "Test", text: "Test", columns: "[]" });
                    const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
                    h.drive(type, node, { ui: { clientId: "c1", action: { type: verb } } });
                }

                // No client overlay command was pushed for a dynamic-state verb.
                expect(client.eventsOfType("command")).toHaveLength(0);
                // The ONE value was written to this client's slot (scope-correct).
                expect(slotValue(dsTest.getClientState(h.appId, "c1")!.state, nodeId, field)).toBe(value);
            });
        }
    }
});

describe("P83: owned NON-visibility verbs push an SSE command frame", () => {
    // ui-table still owns `select` (a genuine client command, not dynamic-state).
    const verbOwnership: Record<string, string[]> = {
        "ui-table": ["select"]
    };

    for (const [type, verbs] of Object.entries(verbOwnership)) {
        const verb = verbs[0];
        it(`${type}: owned verb '${verb}' pushes an SSE command frame`, () => {
            const nodeId = `verb-${type}`;
            const client = h.connectClient("c1");

            registerNode(type, nodeId, { label: "Test", text: "Test", columns: "[]" });
            const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
            h.drive(type, node, { ui: { clientId: "c1", action: { type: verb } } });

            const commands = client.eventsOfType("command");
            expect(commands).toHaveLength(1);
            expect(commands[0].data).toMatchObject({ command: { type: verb, target: nodeId } });
        });
    }
});

describe("P83: a non-owned verb passes through without pushing a command", () => {
    const verbOwnership: Record<string, string[]> = {
        "ui-text": ["show", "hide"],
        "ui-button": ["show", "hide", "enable", "disable"],
        "ui-table": ["show", "hide", "select"],
        "ui-container": ["show", "hide"]
    };

    for (const type of Object.keys(verbOwnership)) {
        // Non-owned verb → pass-through
        const notOwned = "focus"; // "focus" is owned by input nodes, not display nodes
        it(`${type}: non-owned verb '${notOwned}' passes through without pushing a command`, () => {
            const nodeId = `no-verb-${type}`;
            const client = h.connectClient("c2");

            if (type === "ui-container") {
                const node = h.makeNode(type, nodeId);
                const { sent } = h.drive(type, node, { ui: { clientId: "c2", action: { type: notOwned } } });
                expect(client.eventsOfType("command")).toHaveLength(0);
                expect(sent).toHaveLength(1);
            } else {
                registerNode(type, nodeId, { label: "Test", text: "Test", columns: "[]" });
                const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
                const { sent } = h.drive(type, node, { ui: { clientId: "c2", action: { type: notOwned } } });
                expect(client.eventsOfType("command")).toHaveLength(0);
                expect(sent).toHaveLength(1);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// 5. ui-button: click event emission
// ---------------------------------------------------------------------------

describe("P83: ui-button click event emission", () => {
    it("button input with no payload and no component-op emits a click msg on port 0", () => {
        const nodeId = "btn-click";
        registerNode("ui-button", nodeId, { label: "Submit" });

        // A message with ui.clientId but no payload and no component op
        const node = h.makeNode("ui-button", nodeId, h.state.definitions.get(nodeId)!.definition);
        const { sent } = h.drive("ui-button", node, { ui: { clientId: "c1" } });

        expect(sent).toHaveLength(1);
        const out = sent[0] as { ui: { event: string; sourceId: string; clientId: string } };
        expect(out.ui.event).toBe("click");
        expect(out.ui.sourceId).toBe(nodeId);
        expect(out.ui.clientId).toBe("c1");
    });

    it("button with msg.payload updates label (not click)", () => {
        const nodeId = "btn-label";
        registerNode("ui-button", nodeId, { label: "Old" });

        const node = h.makeNode("ui-button", nodeId, h.state.definitions.get(nodeId)!.definition);
        h.drive("ui-button", node, { payload: "New label" });

        const updated = h.state.definitions.get(nodeId)!.definition as Record<string, unknown>;
        expect(updated.label).toBe("New label");
    });
});

// ---------------------------------------------------------------------------
// 6. ui-table: rowSelect event via dispatchClientEvent
// ---------------------------------------------------------------------------

describe("P83: ui-table event dispatch via dispatchClientEvent", () => {
    for (const event of ["rowSelect"] as const) {
        it(`table node emits msg.ui for '${event}' event`, () => {
            const nodeId = `table-${event}`;
            registerNode("ui-table", nodeId, {
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                events: JSON.stringify([event])
            });

            const definitions = h.buildDefinitions([
                { type: "ui-app", id: h.appId, root: h.appId, name: "Display App", layout: "app", z: "f1" },
                {
                    type: "ui-table",
                    id: nodeId,
                    parent: h.appId,
                    columns: JSON.stringify([{ key: "name", label: "Name" }]),
                    events: JSON.stringify([event]),
                    z: "f1"
                }
            ]);

            const { result, emitted } = h.dispatchClientEvent(
                [nodeId],
                { clientId: "c1", event, sourceId: nodeId, params: { rowId: "r1" } },
                definitions
            );

            expect(result.success).toBe(true);
            const out = emitted.get(nodeId)!;
            expect(out).toHaveLength(1);
            expect(out[0]).toMatchObject({ event, sourceId: nodeId });
        });
    }
});

// ---------------------------------------------------------------------------
// 7. ui-list: itemClick event via dispatchClientEvent
// ---------------------------------------------------------------------------

describe("P83: ui-list event dispatch via dispatchClientEvent", () => {
    it("list node emits msg.ui for 'itemClick' event", () => {
        const nodeId = "list-itemClick";
        registerNode("ui-list", nodeId, {
            items: JSON.stringify([{ id: "a", label: "Item A" }]),
            events: JSON.stringify(["itemClick"])
        });

        const definitions = h.buildDefinitions([
            { type: "ui-app", id: h.appId, root: h.appId, name: "Display App", layout: "app", z: "f1" },
            {
                type: "ui-list",
                id: nodeId,
                parent: h.appId,
                items: JSON.stringify([{ id: "a", label: "Item A" }]),
                events: JSON.stringify(["itemClick"]),
                z: "f1"
            }
        ]);

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "itemClick", sourceId: nodeId, params: { value: "a" } },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "itemClick", sourceId: nodeId });
    });
});

// ---------------------------------------------------------------------------
// 8. ui-icon: uses componentStateInputHandler — passes all messages through
// ---------------------------------------------------------------------------

describe("P83: ui-icon passes all messages through", () => {
    it("ui-icon with no matching ui.component op passes msg through", () => {
        const nodeId = "icon-passthrough";
        const node = h.makeNode("ui-icon", nodeId);
        const msg = { payload: "star", topic: "test" };
        const { sent, done } = h.drive("ui-icon", node, msg);

        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(msg);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("ui-icon with valid component op passes msg through (componentStateInputHandler)", () => {
        const nodeId = "icon-component-op";
        const node = h.makeNode("ui-icon", nodeId);
        const { sent } = h.drive("ui-icon", node, {
            ui: { component: { op: "show", id: nodeId } }
        });

        expect(sent).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 9. ui-container: componentStateInputHandler — passes messages through
// ---------------------------------------------------------------------------

describe("P83: ui-container passes messages through via componentStateInputHandler", () => {
    it("ui-container with valid component op passes msg through", () => {
        const nodeId = "container-passthrough";
        const node = h.makeNode("ui-container", nodeId);
        const msg = { ui: { component: { op: "show", id: nodeId } } };
        const { sent } = h.drive("ui-container", node, msg);

        expect(sent).toHaveLength(1);
    });

    it("ui-container with invalid component op drops message (not passed through)", () => {
        const nodeId = "container-invalid-op";
        const node = h.makeNode("ui-container", nodeId);
        const { sent } = h.drive("ui-container", node, {
            ui: { component: { op: "invalid-op", id: nodeId } }
        });

        // componentStateInputHandler drops messages with invalid ops
        expect(sent).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 10. ui-divider: has no input handler (static node) — verified in P76
//     Here we confirm the registry entry has no inputHandler.
// ---------------------------------------------------------------------------

describe("P83: ui-divider — no input handler (static display node)", () => {
    it("runtimeNodeRegistry['ui-divider'].options has no inputHandler property", () => {
        const entry = h.registry["ui-divider"];
        expect(entry).toBeDefined();
        expect((entry as unknown as Record<string, Record<string, unknown>>).options.inputHandler).toBeUndefined();
    });
});
