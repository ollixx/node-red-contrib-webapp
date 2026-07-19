import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NodeBehaviourHarness, webappTest } from "./helpers/node-behaviour-harness";

/**
 * P86 — Classic behaviour tests for the Structure / State / Behavior-category nodes:
 * ui-app, ui-query.
 * (P243/ADR 0040: ui-navigation retired — navigation is a ui-action navigate.)
 *
 * For each node we verify via the shared NodeBehaviourHarness (and the raw
 * webapp.__test__ surface where needed):
 *
 * ui-app:
 *   1. clientConnected event is emitted when a client connects (addStreamClient)
 *      → msg.ui has event="clientConnected", clientId, appId.
 *   2. clientDisconnected event is emitted when a client disconnects
 *      (removeStreamClient) → msg.ui has event="clientDisconnected", clientId, appId.
 *   3. clientConnected/clientDisconnected are emitted only when the app has those
 *      events declared (positional port routing).
 *   4. No emit when events are not declared (no-op gracefully).
 *   5. ui-app interactionInputHandler owns "navigate" and "reset" verbs:
 *      navigate/reset → SSE command push + pass-through.
 *   6. Non-owned verb → pass-through, no SSE push.
 *   7. Message with no ui.action → passThroughInputHandler (pass-through).
 *
 * ui-query:
 *   8. msg without msg.ui.query passes through (no etag, no crash).
 *   9. msg.ui.query with data/error: TERMINAL — absorbed, 0 out-emits (P175 fix).
 *      msg.ui.query with refresh/loading: trigger — 1 out-emit.
 *  10. msg.ui.clientId routes state update server-side; data/error remain terminal
 *      (0 out-emits) regardless of clientId (P175 supersedes the old pass-through).
 *  11. etag deduplication: same etag twice → early return; data returns are also
 *      terminal, so neither first nor second call produces an out-emit (P175).
 *  12. Non-query message (arbitrary payload) passes through unchanged.
 *
 * E2E note (test-conventions.md): the "render" and "editor" tests for these nodes
 * already live in tests/e2e/ (p12-events.spec.ts, nodes/behavior/ui-action.spec.ts).
 * This file covers only the handler
 * behaviour (SSE emit, output events, pass-through). Redundant E2E that tests
 * pure-handler behaviour (e.g. "navigate does NOT update store") is slimmed by P86.
 */

// ---------------------------------------------------------------------------
// Harness + raw test surface
// ---------------------------------------------------------------------------

const h = new NodeBehaviourHarness("structApp");

// Pull the raw add/removeStreamClient from the __test__ surface so we can
// trigger clientConnected / clientDisconnected without spinning up HTTP.
const {
    addStreamClient,
    removeStreamClient,
    runtimeState
} = webappTest;

beforeEach(() => {
    h.reset();
});

afterEach(() => {
    h.teardown();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register a ui-app node in the definitions map so emitAppClientEvent can find
 * it and call send() on it.  We need a fake Node-RED node (with .send) linked
 * via RED.nodes.getNode.
 */
function registerAppNodeWithEvents(
    appId: string,
    events: string[]
): { sent: unknown[][]; nodeId: string } {
    const sent: unknown[][] = [];

    const definition = h.registry["ui-app"].mapConfig({
        id: appId,
        root: appId,
        name: "Test App",
        layout: "app",
        events: JSON.stringify(events)
    });

    // Register the definition (with events) in runtimeState.
    runtimeState.definitions.set(appId, {
        nodeId: appId,   // fakeNodeId same as appId for simplicity
        appId,
        definition
    });

    // Register a fake Node-RED node so RED.nodes.getNode(appId) finds it.
    const fakeNode = {
        id: appId,
        z: undefined as undefined,
        webappDefinition: definition,
        send(msg: unknown) {
            if (Array.isArray(msg)) {
                sent.push(msg as unknown[]);
            } else {
                sent.push([msg]);
            }
        }
    };

    h.setRED({
        nodes: {
            getNode: (id: string) => (id === appId ? fakeNode : undefined)
        }
    });

    return { sent, nodeId: appId };
}

// ---------------------------------------------------------------------------
// 1–4. ui-app: clientConnected / clientDisconnected emission
// ---------------------------------------------------------------------------

describe("P86: ui-app clientConnected emission", () => {
    it("emits clientConnected when a client connects to an app with that event declared", () => {
        const appId = "structApp";
        const { sent } = registerAppNodeWithEvents(appId, ["clientConnected"]);

        addStreamClient(appId, "browser-1", { write: () => {} }, "/");

        expect(sent).toHaveLength(1);
        const msg = sent[0][0] as { ui: Record<string, unknown> };
        expect(msg.ui).toMatchObject({
            event: "clientConnected",
            clientId: "browser-1",
            appId
        });
    });

    it("emits clientConnected on the correct positional port when multiple events are declared", () => {
        const appId = "structApp";
        const { sent } = registerAppNodeWithEvents(appId, ["clientConnected", "clientDisconnected"]);

        addStreamClient(appId, "browser-a", { write: () => {} }, "/");

        // clientConnected is port 0 (index 0 in events list) → plain message, not array.
        expect(sent).toHaveLength(1);
        const msg = sent[0][0] as { ui: Record<string, unknown> };
        expect(msg.ui.event).toBe("clientConnected");
        expect(msg.ui.clientId).toBe("browser-a");
    });
});

describe("P86: ui-app clientDisconnected emission", () => {
    it("emits clientDisconnected when a client disconnects (removeStreamClient)", () => {
        const appId = "structApp";
        const { sent } = registerAppNodeWithEvents(appId, ["clientDisconnected"]);

        // Register the client first so there is something to remove.
        addStreamClient(appId, "browser-2", { write: () => {} }, "/");
        // Clear any clientConnected sends (not declared in this test).
        sent.length = 0;

        removeStreamClient(appId, "browser-2");

        expect(sent).toHaveLength(1);
        const msg = sent[0][0] as { ui: Record<string, unknown> };
        expect(msg.ui).toMatchObject({
            event: "clientDisconnected",
            clientId: "browser-2",
            appId
        });
    });

    it("emits clientDisconnected on the correct positional port", () => {
        const appId = "structApp";
        const { sent } = registerAppNodeWithEvents(appId, ["clientConnected", "clientDisconnected"]);

        addStreamClient(appId, "browser-b", { write: () => {} }, "/");
        sent.length = 0;   // clear clientConnected

        removeStreamClient(appId, "browser-b");

        // clientDisconnected is port 1 (index 1 in events list) → sparse array.
        expect(sent).toHaveLength(1);
        const outputs = sent[0];
        // Port 1: outputs = [null, message]
        expect(outputs[0]).toBeNull();
        const msg = outputs[1] as { ui: Record<string, unknown> };
        expect(msg.ui.event).toBe("clientDisconnected");
        expect(msg.ui.clientId).toBe("browser-b");
    });
});

describe("P86: ui-app no emit when events not declared", () => {
    it("does NOT emit clientConnected when the app declares no events", () => {
        const appId = "structApp";
        const { sent } = registerAppNodeWithEvents(appId, []); // no events

        addStreamClient(appId, "browser-3", { write: () => {} }, "/");

        expect(sent).toHaveLength(0);
    });

    it("does NOT emit clientConnected when only clientDisconnected is declared", () => {
        const appId = "structApp";
        const { sent } = registerAppNodeWithEvents(appId, ["clientDisconnected"]);

        addStreamClient(appId, "browser-4", { write: () => {} }, "/");

        expect(sent).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 5–7. ui-app interaction handler: navigate / reset / non-owned / pass-through
// ---------------------------------------------------------------------------

describe("P86: ui-app interactionInputHandler — navigate verb → SSE command push", () => {
    it("navigate verb pushes SSE command frame and passes msg through", () => {
        const nodeId = "structApp"; // uses the default harness appId
        const client = h.connectClient("c1");
        const node = h.makeNode("ui-app", nodeId);

        const { sent, done } = h.drive("ui-app", node, {
            ui: { clientId: "c1", action: { type: "navigate", to: "/" } }
        });

        const commands = client.eventsOfType("command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "navigate", target: nodeId } });
        expect(sent).toHaveLength(1);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("reset verb pushes SSE command frame and passes msg through", () => {
        const nodeId = "structApp";
        const client = h.connectClient("c2");
        const node = h.makeNode("ui-app", nodeId);

        h.drive("ui-app", node, {
            ui: { clientId: "c2", action: { type: "reset" } }
        });

        const commands = client.eventsOfType("command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data).toMatchObject({ command: { type: "reset", target: nodeId } });
    });
});

describe("P86: ui-app interactionInputHandler — non-owned verb passes through", () => {
    it("non-owned verb 'select' passes through without SSE push", () => {
        const nodeId = "structApp";
        const client = h.connectClient("c3");
        const node = h.makeNode("ui-app", nodeId);

        const { sent } = h.drive("ui-app", node, {
            ui: { clientId: "c3", action: { type: "select" } }
        });

        expect(client.eventsOfType("command")).toHaveLength(0);
        expect(sent).toHaveLength(1);
    });
});

describe("P86: ui-app — message with no ui.action passes through", () => {
    it("message without ui.action passes through (passThroughInputHandler)", () => {
        const nodeId = "structApp";
        const node = h.makeNode("ui-app", nodeId);
        const msg = { topic: "whatever", payload: 42 };
        const { sent, done } = h.drive("ui-app", node, msg);

        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(msg);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// 8–12. ui-query: clientId routing, pass-through, etag deduplication
// ---------------------------------------------------------------------------

describe("P86: ui-query — message without msg.ui.query passes through", () => {
    it("message without msg.ui passes through unchanged", () => {
        const node = h.makeNode("ui-query", "q1");
        const msg = { payload: "something" };
        const { sent, done } = h.drive("ui-query", node, msg);

        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(msg);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("message with msg.ui but no msg.ui.query passes through unchanged", () => {
        const node = h.makeNode("ui-query", "q2");
        const msg = { ui: { clientId: "c1" } };
        const { sent, done } = h.drive("ui-query", node, msg);

        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(msg);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

// P175: data/error returns are TERMINAL — they are absorbed and NOT forwarded.
// msg.ui.clientId routing applies server-side (state update targets the per-client
// state) but the message is NOT emitted at the out-port.
describe("P86/P175: ui-query — data/error returns are terminal (no out-port emit)", () => {
    it("data return with clientId: absorbed (0 out-emits) — terminal per ADR 0016", () => {
        const node = h.makeNode("ui-query", "q3");
        const msg = { ui: { clientId: "browser-5", query: { queryPath: "items.list", data: [] } } };
        const { sent } = h.drive("ui-query", node, msg);

        // P175 fix: data is terminal → no out-port emit (prevents infinite loop).
        expect(sent).toHaveLength(0);
    });

    it("data return without clientId: absorbed (0 out-emits) — terminal", () => {
        const node = h.makeNode("ui-query", "q4");
        const msg = { ui: { query: { queryPath: "items.list", data: [] } } };
        const { sent } = h.drive("ui-query", node, msg);

        expect(sent).toHaveLength(0);
    });
});

// P175: data/error are terminal — no out-port emit regardless of etag.
// The etag short-circuit still applies (same etag → early return without state update),
// but since data returns are terminal, NEITHER call produces an out-port emit.
describe("P86/P175: ui-query — etag deduplication (data returns remain terminal)", () => {
    it("data+etag: first call absorbed (terminal, 0 out-emits); same etag again: short-circuited (0 out-emits)", () => {
        const node = h.makeNode("ui-query", "q-etag1");
        const msg = { ui: { query: { queryPath: "data.list", etag: "v1", data: [] } } };

        const { sent: sent1 } = h.drive("ui-query", node, msg);
        const { sent: sent2 } = h.drive("ui-query", node, msg);

        // P175: data is terminal → no out-emit on first call either.
        expect(sent1).toHaveLength(0);
        // etag deduplication → early return (no state update, no send).
        expect(sent2).toHaveLength(0);
    });

    it("data+different etag: both absorbed (terminal, 0 out-emits each)", () => {
        const node = h.makeNode("ui-query", "q-etag2");
        const msg1 = { ui: { query: { queryPath: "data.list", etag: "v1", data: [] } } };
        const msg2 = { ui: { query: { queryPath: "data.list", etag: "v2", data: [1] } } };

        const { sent: sent1 } = h.drive("ui-query", node, msg1);
        const { sent: sent2 } = h.drive("ui-query", node, msg2);

        // P175: both are terminal data returns → no out-port emit in either case.
        expect(sent1).toHaveLength(0);
        expect(sent2).toHaveLength(0);
    });
});

describe("P86: ui-query — arbitrary payload passes through unchanged", () => {
    it("non-query message passes through unchanged", () => {
        const node = h.makeNode("ui-query", "q5");
        const msg = { topic: "irrelevant", payload: { x: 1 } };
        const { sent } = h.drive("ui-query", node, msg);

        expect(sent).toHaveLength(1);
        expect(sent[0]).toBe(msg);
    });
});

// ---------------------------------------------------------------------------
// P243 (ADR 0040): the ui-navigation node is retired — navigation is solely a
// ui-action with actionType:"navigate". Its former handler tests (13–16) are
// gone with the node; the navigate message contract is covered by
// tests/e2e/nodes/behavior/p66-navigation.spec.ts.
// ---------------------------------------------------------------------------
