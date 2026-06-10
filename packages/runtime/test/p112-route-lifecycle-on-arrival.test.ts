import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P112 — connect-based route lifecycle (onEnter/onLeave on EVERY arrival).
 *
 * The client navigates by full page-reload, so every arrival (deep-link,
 * refresh, in-app navigate) ends in a fresh SSE connect carrying a per-page-load
 * nonce (loadId). The server fires onEnter/onLeave from the CONNECT, keyed on
 * that nonce, so:
 *   - a new loadId = a real arrival                → onEnter (+ onLeave on switch)
 *   - the same loadId = a transient reconnect      → no event
 *   - a disconnect without reconnect (grace expiry) → onLeave + clientDisconnected
 *
 * performTargetNavigate no longer emits onEnter/onLeave (the reload→connect path
 * owns the lifecycle) — only the navigate push remains.
 */

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

const APP_ID = "lifecycleApp";

function makeFakeRes() {
    return {
        write: () => {},
        on: () => {}
    };
}

function registerDef(nodeId: string, definition: Record<string, unknown>, node?: unknown) {
    t.runtimeState.definitions.set(nodeId, {
        nodeId,
        appId: definition.type === "ui-app" ? definition.id : undefined,
        definition,
        _node: node
    });
    return node;
}

// Build a deployable app: ui-app root + one customers/:id route, with a node for
// each so findRouteNodeForLocation resolves a real RED node we can spy on.
function setupApp(opts: { appEvents?: string[]; routeEvents?: string[] } = {}) {
    const appNode: any = {
        id: "appNode",
        send: vi.fn(),
        webappDefinition: {
            type: "ui-app", id: APP_ID, name: "Lifecycle", root: APP_ID, layout: "vertical",
            events: opts.appEvents
        }
    };
    const routeNode: any = {
        id: "routeNode",
        send: vi.fn(),
        webappDefinition: {
            type: "ui-route", id: "customers", path: "/customers/:id", layout: "vertical",
            events: opts.routeEvents || ["onEnter", "onLeave"]
        }
    };
    registerDef(APP_ID, appNode.webappDefinition, appNode);
    registerDef("routeNode", routeNode.webappDefinition, routeNode);
    t.runtimeState.RED = {
        nodes: {
            // The app registration's nodeId is APP_ID (see registerDef); resolve
            // both that and the literal node ids to the right node.
            getNode: (id: string) =>
                id === "routeNode" ? routeNode : (id === "appNode" || id === APP_ID) ? appNode : undefined
        },
        util: {}
    };
    return { appNode, routeNode };
}

// Flatten every msg passed to node.send across all calls. A positional out-port
// emit (event index > 0) sends a SPARSE ARRAY [null, …, msg]; index 0 sends a
// plain message. Collect both shapes so we can assert on any event regardless of
// which port it lands on.
function sentMessages(node: any): any[] {
    const out: any[] = [];
    for (const call of node.send.mock.calls) {
        const arg = call[0];
        if (Array.isArray(arg)) {
            for (const m of arg) {
                if (m) out.push(m);
            }
        }
        else if (arg) {
            out.push(arg);
        }
    }
    return out;
}

function eventsOf(node: any, name: string) {
    return sentMessages(node).filter((m: any) => m && m.ui && m.ui.event === name);
}

beforeEach(() => {
    t.runtimeState.liveState.clear();
    t.runtimeState.clientStateMap.clear();
    t.runtimeState.streamClients.clear();
    t.runtimeState.clientArrival.clear();
    t.runtimeState.definitions.clear();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    t.runtimeState.RED = undefined;
});

describe("P112: deep-link / first arrival", () => {
    it("a connect at /customers/123 with a fresh loadId fires onEnter on the route with params", () => {
        const { routeNode } = setupApp();
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/123", "load-A");

        const enters = eventsOf(routeNode, "onEnter");
        expect(enters).toHaveLength(1);
        expect(enters[0].ui.event).toBe("onEnter");
        expect(enters[0].ui.route).toBe("/customers/123");
        expect(enters[0].ui.params).toMatchObject({ id: "123" });
        expect(enters[0].ui.clientId).toBe("c1");
        // No spurious onLeave on a first arrival.
        expect(eventsOf(routeNode, "onLeave")).toHaveLength(0);
    });
});

describe("P112: root '/' deep-link fires onEnter on the ui-app node", () => {
    it("emits onEnter on the app when it declares the event", () => {
        const { appNode } = setupApp({ appEvents: ["onEnter", "onLeave"] });
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/", "load-root");

        const enters = eventsOf(appNode, "onEnter");
        expect(enters).toHaveLength(1);
        expect(enters[0].ui.route).toBe("/");
    });
});

describe("P112: transient reconnect (same loadId) is silent", () => {
    it("a second connect with the SAME loadId fires no further onEnter", () => {
        const { routeNode } = setupApp();
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/1", "load-X");
        expect(eventsOf(routeNode, "onEnter")).toHaveLength(1);

        // Native EventSource reconnect: same document → same loadId + location.
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/1", "load-X");
        expect(eventsOf(routeNode, "onEnter")).toHaveLength(1);
        expect(eventsOf(routeNode, "onLeave")).toHaveLength(0);
    });
});

describe("P112: refresh (new loadId, same location) fires onEnter, no onLeave", () => {
    it("re-loading the same route fires onEnter again but not onLeave", () => {
        const { routeNode } = setupApp();
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/7", "load-1");
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/7", "load-2");

        expect(eventsOf(routeNode, "onEnter")).toHaveLength(2);
        expect(eventsOf(routeNode, "onLeave")).toHaveLength(0);
    });
});

describe("P112: A→B switch (new loadId, new location)", () => {
    it("fires onLeave(A) exactly once then onEnter(B) exactly once", () => {
        const { appNode, routeNode } = setupApp({ appEvents: ["onEnter", "onLeave"] });
        // Arrive at root A=/
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/", "load-A");
        appNode.send.mockClear();
        routeNode.send.mockClear();

        // Full-reload navigate to B=/customers/9 (new document → new loadId).
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/9", "load-B");

        // onLeave on the route that owned A (the app root "/").
        const leaves = eventsOf(appNode, "onLeave");
        expect(leaves).toHaveLength(1);
        expect(leaves[0].ui.route).toBe("/");
        // onEnter on B.
        const enters = eventsOf(routeNode, "onEnter");
        expect(enters).toHaveLength(1);
        expect(enters[0].ui.route).toBe("/customers/9");
        expect(enters[0].ui.params).toMatchObject({ id: "9" });
    });
});

describe("P112: performTargetNavigate no longer emits onEnter/onLeave", () => {
    it("a navigate wired to the route pushes the navigate command WITHOUT firing onEnter", () => {
        const res = { frames: [] as string[], write(c: string) { this.frames.push(c); }, on: () => {} };
        const { routeNode } = setupApp();
        t.addStreamClient(APP_ID, "c1", res, "/", "load-start");
        routeNode.send.mockClear();

        const routeHandler = t.runtimeNodeRegistry["ui-route"].options.inputHandler;
        routeHandler(
            routeNode,
            { ui: { clientId: "c1", action: { type: "navigate", params: { id: "42" } } } },
            vi.fn(),
            vi.fn()
        );

        // The navigate command IS still pushed to the client.
        const pushed = res.frames.join("");
        expect(pushed).toContain("\"type\":\"navigate\"");
        expect(pushed).toContain("/customers/42");
        // But NO onEnter/onLeave is emitted from the navigate path itself.
        expect(eventsOf(routeNode, "onEnter")).toHaveLength(0);
        expect(eventsOf(routeNode, "onLeave")).toHaveLength(0);
    });
});

describe("P112: leave on disconnect, grace-debounced", () => {
    it("a disconnect with NO reconnect fires onLeave after the grace period", () => {
        const { routeNode } = setupApp();
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/5", "load-D");
        routeNode.send.mockClear();

        t.removeStreamClient(APP_ID, "c1");
        // Not yet — within the grace period.
        expect(eventsOf(routeNode, "onLeave")).toHaveLength(0);

        vi.advanceTimersByTime(t.ARRIVAL_LEAVE_GRACE_MS + 10);
        const leaves = eventsOf(routeNode, "onLeave");
        expect(leaves).toHaveLength(1);
        expect(leaves[0].ui.route).toBe("/customers/5");
        // Arrival record is cleared.
        expect(t.runtimeState.clientArrival.get(APP_ID)).toBeUndefined();
    });

    it("a reconnect within the grace period cancels the pending onLeave", () => {
        const { routeNode } = setupApp();
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/5", "load-D");
        routeNode.send.mockClear();

        t.removeStreamClient(APP_ID, "c1");
        // Transient drop: same document reconnects with the same loadId+location.
        vi.advanceTimersByTime(t.ARRIVAL_LEAVE_GRACE_MS - 500);
        t.addStreamClient(APP_ID, "c1", makeFakeRes(), "/customers/5", "load-D");
        vi.advanceTimersByTime(t.ARRIVAL_LEAVE_GRACE_MS + 10);

        // No onLeave (cancelled) and no extra onEnter (same loadId reconnect).
        expect(eventsOf(routeNode, "onLeave")).toHaveLength(0);
        expect(eventsOf(routeNode, "onEnter")).toHaveLength(0);
    });
});
