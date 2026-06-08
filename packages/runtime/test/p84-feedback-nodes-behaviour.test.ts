import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness } from "./helpers/node-behaviour-harness";

/**
 * P84 — Classic behaviour tests for the feedback-category nodes:
 * ui-alert, ui-badge, ui-progress, ui-skeleton, ui-empty-state, ui-toast, ui-log.
 *
 * For each node we verify via the shared NodeBehaviourHarness:
 *
 * viewNodePatchInputHandler nodes (ui-alert, ui-badge, ui-progress):
 *   1. msg.payload → updates the primary binding field in the stored definition.
 *   2. Pass-through: an unrecognised msg (no payload, no ui.action) passes through.
 *
 * componentStateInputHandler nodes (ui-skeleton, ui-empty-state):
 *   3. A valid component op (show/hide) → msg is passed through (no drop).
 *   4. An invalid component op → message is DROPPED (done(), no send).
 *   5. A message without a component op → passed through.
 *
 * ui-toast (toastInputHandler):
 *   6. A valid msg.ui.toast (with message) → SSE toast frame pushed + pass-through.
 *   7. msg.ui.toast overrides (severity/position/duration) are forwarded to clients.
 *   8. msg.ui.clientId targets only that specific client (not broadcast).
 *   9. msg.payload used as toast message when no msg.ui.toast.message.
 *
 * ui-log (passThroughInputHandler — no input port by design):
 *  10. Any message passes through unchanged (log is driven by SSE, not node input).
 *
 * ui-alert dismiss event (dispatchClientEvent path):
 *  11. A dismiss event dispatched by the client emits msg.ui on the alert node's port 0.
 *
 * E2E note (test-conventions.md): the "inject → re-navigate → DOM update" behaviour
 * is fully covered here. Remaining E2E specs cover only client rendering. The
 * ui-log minSeverity/maxEntries logic is client-JS already fully covered by E2E
 * (tests/e2e/nodes/view/ui-log.spec.ts, P57); no server-side unit test is needed
 * for those fields.
 */

const h = new NodeBehaviourHarness("feedbackApp");

beforeEach(() => {
    h.reset();
});

afterEach(() => {
    h.teardown();
});

// ---------------------------------------------------------------------------
// Helper: register a feedback node definition so viewNodePatchInputHandler can
// find it in runtimeState.definitions.
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
// 1. msg.payload → updates the primary binding field
// ---------------------------------------------------------------------------

describe("P84: msg.payload updates the stored primary binding field", () => {
    const cases: Array<[string, unknown, string, Record<string, unknown>]> = [
        ["ui-alert", "Something happened", "message", { message: { kind: "literal", value: "" } }],
        ["ui-badge", 42, "value", { value: { kind: "literal", value: 0 } }],
        ["ui-progress", 75, "value", { value: { kind: "literal", value: 0 } }]
    ];

    for (const [type, payload, field, extra] of cases) {
        it(`${type}: msg.payload sets definition.${field} as a literal binding`, () => {
            const nodeId = `pay-${type}`;
            registerNode(type, nodeId, extra);

            const node = h.makeNode(type, nodeId, h.state.definitions.get(nodeId)!.definition);
            const { sent, done } = h.drive(type, node, { payload });

            const updated = h.state.definitions.get(nodeId)!.definition as Record<string, unknown>;
            const val = updated[field] as { kind: string; value: unknown };
            expect(val).toMatchObject({ kind: "literal", value: payload });

            // msg always passes through
            expect(sent).toHaveLength(1);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 2. Pass-through — no payload, no interaction verb
// ---------------------------------------------------------------------------

describe("P84: pass-through — no payload and no interaction verb", () => {
    const types = ["ui-alert", "ui-badge", "ui-progress"];

    for (const type of types) {
        it(`${type}: passes through a message with no matching payload or verb`, () => {
            const nodeId = `pt-${type}`;
            registerNode(type, nodeId, {
                message: { kind: "literal", value: "test" },
                value: { kind: "literal", value: 0 }
            });

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
// 3. componentStateInputHandler nodes — valid op → msg passes through
//
// ui-skeleton and ui-empty-state use componentStateInputHandler directly.
// That handler passes the msg through for valid ops (show/hide/enable/disable
// etc.) — it does NOT push an SSE command frame. SSE command push is only done
// by the interactionInputHandler wrapper, which these nodes do NOT use.
// ---------------------------------------------------------------------------

describe("P84: skeleton/empty-state — valid op passes msg through", () => {
    const types = ["ui-skeleton", "ui-empty-state"];

    for (const type of types) {
        it(`${type}: 'show' op: msg is passed through (componentStateInputHandler)`, () => {
            const nodeId = `op-${type}`;

            const node = h.makeNode(type, nodeId);
            const msg = { ui: { component: { op: "show", id: nodeId } } };
            const { sent, done } = h.drive(type, node, msg);

            // componentStateInputHandler passes through for valid ops
            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(msg);
            expect(done).toHaveBeenCalledTimes(1);
        });

        it(`${type}: 'hide' op: msg is passed through (componentStateInputHandler)`, () => {
            const nodeId = `op-hide-${type}`;

            const node = h.makeNode(type, nodeId);
            const msg = { ui: { component: { op: "hide", id: nodeId } } };
            const { sent, done } = h.drive(type, node, msg);

            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(msg);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 4. componentStateInputHandler nodes — invalid op → message dropped
// ---------------------------------------------------------------------------

describe("P84: skeleton/empty-state — invalid op drops the message", () => {
    const types = ["ui-skeleton", "ui-empty-state"];

    for (const type of types) {
        it(`${type}: an unrecognised op is dropped (done() called, no send)`, () => {
            const nodeId = `bad-${type}`;

            const node = h.makeNode(type, nodeId);
            const { sent, done } = h.drive(type, node, {
                ui: { component: { op: "explode", id: nodeId } }
            });

            // componentStateInputHandler drops invalid ops: calls done(), not send()
            expect(sent).toHaveLength(0);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 5. componentStateInputHandler nodes — no component op → pass-through
// ---------------------------------------------------------------------------

describe("P84: skeleton/empty-state — message without component op passes through", () => {
    const types = ["ui-skeleton", "ui-empty-state"];

    for (const type of types) {
        it(`${type}: message without ui.component passes through`, () => {
            const nodeId = `noop-${type}`;

            const node = h.makeNode(type, nodeId);
            const msg = { topic: "nothing" };
            const { sent, done } = h.drive(type, node, msg);

            expect(sent).toHaveLength(1);
            expect(sent[0]).toBe(msg);
            expect(done).toHaveBeenCalledTimes(1);
        });
    }
});

// ---------------------------------------------------------------------------
// 6. ui-toast — valid toast (with message) → SSE toast frame pushed
// ---------------------------------------------------------------------------

describe("P84: ui-toast — valid msg.ui.toast pushes an SSE toast frame", () => {
    it("toast message triggers SSE toast event and passes msg through", () => {
        const nodeId = "toast1";
        const definition = h.registry["ui-toast"].mapConfig({
            id: nodeId,
            parent: h.appId,
            severity: "info",
            duration: 3000,
            position: "top-right"
        });
        const node = h.makeNode("ui-toast", nodeId, definition);
        const client = h.connectClient("c1");

        const msg = {
            ui: {
                clientId: "c1",
                toast: {
                    message: "Hello world",
                    severity: "success"
                }
            }
        };
        const { sent, done } = h.drive("ui-toast", node, msg);

        // SSE toast frame must be pushed
        const toastFrames = client.eventsOfType("toast");
        expect(toastFrames).toHaveLength(1);
        expect(toastFrames[0].data).toMatchObject({ toast: { message: "Hello world", severity: "success" } });

        // msg passes through
        expect(sent).toHaveLength(1);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// 7. ui-toast — msg.ui.toast overrides (severity/position/duration)
// ---------------------------------------------------------------------------

describe("P84: ui-toast — msg overrides node defaults", () => {
    it("msg.ui.toast fields override node definition defaults", () => {
        const nodeId = "toast-override";
        const definition = h.registry["ui-toast"].mapConfig({
            id: nodeId,
            parent: h.appId,
            severity: "info",
            duration: 4000,
            position: "bottom-right"
        });
        const node = h.makeNode("ui-toast", nodeId, definition);
        const client = h.connectClient("c1");

        h.drive("ui-toast", node, {
            ui: {
                clientId: "c1",
                toast: {
                    message: "Override test",
                    severity: "warning",
                    position: "top-center",
                    duration: 1000
                }
            }
        });

        const frames = client.eventsOfType("toast");
        expect(frames).toHaveLength(1);
        const toast = frames[0].data as { toast: Record<string, unknown> };
        expect(toast.toast.severity).toBe("warning");
        expect(toast.toast.position).toBe("top-center");
        expect(toast.toast.duration).toBe(1000);
    });

    it("missing override fields fall back to node-definition defaults", () => {
        const nodeId = "toast-defaults";
        const definition = h.registry["ui-toast"].mapConfig({
            id: nodeId,
            parent: h.appId,
            severity: "danger",
            duration: 5000,
            position: "bottom-center"
        });
        const node = h.makeNode("ui-toast", nodeId, definition);
        const client = h.connectClient("c1");

        h.drive("ui-toast", node, {
            ui: { clientId: "c1", toast: { message: "Default fallback" } }
        });

        const frames = client.eventsOfType("toast");
        expect(frames).toHaveLength(1);
        const toast = frames[0].data as { toast: Record<string, unknown> };
        expect(toast.toast.severity).toBe("danger");
        expect(toast.toast.position).toBe("bottom-center");
        expect(toast.toast.duration).toBe(5000);
    });
});

// ---------------------------------------------------------------------------
// 8. ui-toast — msg.ui.clientId targets only that client (not broadcast)
// ---------------------------------------------------------------------------

describe("P84: ui-toast — clientId targeting", () => {
    it("with clientId, only the targeted client receives the toast SSE frame", () => {
        const nodeId = "toast-target";
        const definition = h.registry["ui-toast"].mapConfig({
            id: nodeId,
            parent: h.appId,
            severity: "info"
        });
        const node = h.makeNode("ui-toast", nodeId, definition);

        const client1 = h.connectClient("c1");
        const client2 = h.connectClient("c2");

        h.drive("ui-toast", node, {
            ui: {
                clientId: "c1",
                toast: { message: "For c1 only" }
            }
        });

        // c1 gets the toast, c2 does not
        expect(client1.eventsOfType("toast")).toHaveLength(1);
        expect(client2.eventsOfType("toast")).toHaveLength(0);
    });

    it("without clientId, all connected clients receive the toast (broadcast)", () => {
        const nodeId = "toast-broadcast";
        const definition = h.registry["ui-toast"].mapConfig({
            id: nodeId,
            parent: h.appId,
            severity: "info"
        });
        const node = h.makeNode("ui-toast", nodeId, definition);

        const client1 = h.connectClient("d1");
        const client2 = h.connectClient("d2");

        h.drive("ui-toast", node, {
            ui: { toast: { message: "Broadcast toast" } }
        });

        // Both clients receive the toast
        expect(client1.eventsOfType("toast")).toHaveLength(1);
        expect(client2.eventsOfType("toast")).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 9. ui-toast — msg.payload used as message when no msg.ui.toast.message
// ---------------------------------------------------------------------------

describe("P84: ui-toast — msg.payload as fallback toast message", () => {
    it("msg.payload is used as toast message when msg.ui.toast.message is absent", () => {
        const nodeId = "toast-payload";
        const definition = h.registry["ui-toast"].mapConfig({
            id: nodeId,
            parent: h.appId,
            severity: "info"
        });
        const node = h.makeNode("ui-toast", nodeId, definition);
        const client = h.connectClient("c1");

        h.drive("ui-toast", node, {
            ui: { clientId: "c1" },
            payload: "Payload as message"
        });

        const frames = client.eventsOfType("toast");
        expect(frames).toHaveLength(1);
        const toast = frames[0].data as { toast: Record<string, unknown> };
        expect(toast.toast.message).toBe("Payload as message");
    });

    it("msg with no payload and no msg.ui.toast still passes through", () => {
        const nodeId = "toast-noTrigger";
        const definition = h.registry["ui-toast"].mapConfig({
            id: nodeId,
            parent: h.appId,
            severity: "info"
        });
        const node = h.makeNode("ui-toast", nodeId, definition);
        const { sent } = h.drive("ui-toast", node, { topic: "nothing" });

        // msg always passes through (toastInputHandler always calls send)
        expect(sent).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 10. ui-log — pass-through (no input port by design; any msg passes through)
// ---------------------------------------------------------------------------

describe("P84: ui-log — pass-through (log is driven by SSE, not node input)", () => {
    it("ui-log passes any message through unchanged", () => {
        const nodeId = "log1";
        const node = h.makeNode("ui-log", nodeId);
        const msg = { payload: "should pass through", topic: "test" };
        const { sent, done } = h.drive("ui-log", node, msg);

        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(msg);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("ui-log passes structured ui messages through as well", () => {
        const nodeId = "log2";
        const node = h.makeNode("ui-log", nodeId);
        const msg = { ui: { event: "click", sourceId: "btn1" } };
        const { sent } = h.drive("ui-log", node, msg);

        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(msg);
    });
});

// ---------------------------------------------------------------------------
// 11. ui-alert dismiss event via dispatchClientEvent
// ---------------------------------------------------------------------------

describe("P84: ui-alert dismiss event dispatched by client emits msg.ui on output port", () => {
    it("dismiss event emits msg.ui with event='dismiss' and sourceId on port 0", () => {
        const nodeId = "alert-dismiss";

        const definitions = h.buildDefinitions([
            { type: "ui-app", id: h.appId, root: h.appId, name: "Feedback App", layout: "app", z: "f1" },
            {
                type: "ui-alert",
                id: nodeId,
                parent: h.appId,
                message: { kind: "literal", value: "Watch out" },
                dismissible: true,
                z: "f1"
            }
        ]);

        const { result, emitted } = h.dispatchClientEvent(
            [nodeId],
            { clientId: "c1", event: "dismiss", sourceId: nodeId, params: {} },
            definitions
        );

        expect(result.success).toBe(true);
        const out = emitted.get(nodeId)!;
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ event: "dismiss", sourceId: nodeId, clientId: "c1" });
    });
});
