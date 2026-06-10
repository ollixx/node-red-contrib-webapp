import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P66 (ADR 0007) — ui-action / ui-route / ui-app navigation.
 *
 * Two navigate scenarios (P118 reframes these as target modes — see
 * p118-navigate-target-modes.test.ts):
 *   1. wire mode: the action carries params, no `to`; the receiving ui-route
 *      builds the location from its OWN path + params.
 *   2. url mode: the action carries a `to` (str/msg/flow/global/jsonata);
 *      the receiving route/app passes the addressed location through.
 * P118 removed the old ambiguity / no-destination / dead-link cross-validation.
 */

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

const APP_ID = "navApp";

function makeFakeRes() {
    const frames: string[] = [];
    return {
        frames,
        write(chunk: string) {
            frames.push(chunk);
        },
        events(): Array<{ event: string; data: any }> {
            return frames
                .join("")
                .split("\n\n")
                .filter((block) => block.includes("event:"))
                .map((block) => {
                    const lines = block.split("\n");
                    const eventLine = lines.find((l) => l.startsWith("event: "))!;
                    const dataLine = lines.find((l) => l.startsWith("data: "))!;
                    return {
                        event: eventLine.slice("event: ".length),
                        data: JSON.parse(dataLine.slice("data: ".length))
                    };
                });
        }
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

beforeEach(() => {
    t.runtimeState.liveState.clear();
    t.runtimeState.clientStateMap.clear();
    t.runtimeState.streamClients.clear();
    t.runtimeState.clientArrival.clear();
    t.runtimeState.definitions.clear();
});

afterEach(() => {
    t.runtimeState.RED = undefined;
});

describe("P66: resolveActionTo (navigate `to` typedInput)", () => {
    it("str type returns the literal path", () => {
        t.runtimeState.RED = { util: {} };
        expect(t.resolveActionTo({ id: "a" }, "/customers/42", "str", {})).toBe("/customers/42");
    });

    it("missing toType defaults to a literal string", () => {
        t.runtimeState.RED = { util: {} };
        expect(t.resolveActionTo({ id: "a" }, "/home", undefined, {})).toBe("/home");
    });

    it("msg type reads the destination from the message", () => {
        t.runtimeState.RED = {
            util: {
                evaluateNodeProperty: (value: string, type: string, _node: unknown, msg: any) => {
                    expect(type).toBe("msg");
                    return msg[value];
                }
            }
        };
        expect(t.resolveActionTo({ id: "a" }, "dest", "msg", { dest: "/orders/7" })).toBe("/orders/7");
    });

    it("jsonata type evaluates the expression against the message", () => {
        t.runtimeState.RED = {
            util: {
                prepareJSONataExpression: (expr: string) => ({ expr }),
                evaluateJSONataExpression: (prepared: any, msg: any) => {
                    expect(prepared.expr).toBe("'/c/' & payload.id");
                    return `/c/${msg.payload.id}`;
                }
            }
        };
        expect(t.resolveActionTo({ id: "a" }, "'/c/' & payload.id", "jsonata", { payload: { id: 99 } })).toBe("/c/99");
    });

    it("an empty `to` resolves to undefined", () => {
        t.runtimeState.RED = { util: {} };
        expect(t.resolveActionTo({ id: "a" }, "", "str", {})).toBeUndefined();
    });
});

describe("P66: resolveNavigateLocation", () => {
    it("ui-route fills its OWN path with action params (Scenario 1)", () => {
        const node = { id: "r1", webappDefinition: { type: "ui-route", id: "customerDetail", path: "/customers/:id" } };
        const location = t.resolveNavigateLocation(node, { type: "navigate", params: { id: "42" } });
        expect(location).toBe("/customers/42");
    });

    it("ui-app with no `to` navigates to the implicit root '/' (Scenario 1)", () => {
        const node = { id: "app", webappDefinition: { type: "ui-app", id: APP_ID } };
        expect(t.resolveNavigateLocation(node, { type: "navigate" })).toBe("/");
    });

    it("ui-app with a `to` template fills it from params (Scenario 2)", () => {
        const node = { id: "app", webappDefinition: { type: "ui-app", id: APP_ID } };
        const location = t.resolveNavigateLocation(node, { type: "navigate", to: "/orders/:oid", params: { oid: "5" } });
        expect(location).toBe("/orders/5");
    });
});

describe("P66 Scenario 1: ui-route navigate handler (own path + params)", () => {
    it("a navigate wired to a ui-route builds the location from the route path and pushes navigate (P112: NO onEnter from the navigate path)", () => {
        const res = makeFakeRes();
        registerDef(APP_ID, { type: "ui-app", id: APP_ID, name: "Nav", root: APP_ID, layout: "vertical" });
        const routeNode: any = { id: "routeNode", send: vi.fn(), webappDefinition: { type: "ui-route", id: "customerDetail", path: "/customers/:id", layout: "vertical", events: ["onEnter"] } };
        registerDef("routeNode", routeNode.webappDefinition, routeNode);
        t.runtimeState.RED = { nodes: { getNode: (id: string) => (id === "routeNode" ? routeNode : undefined) } };
        t.addStreamClient(APP_ID, "c1", res, "/", "load-nav1");

        const routeHandler = t.runtimeNodeRegistry["ui-route"].options.inputHandler;
        const send = vi.fn();
        const done = vi.fn();
        routeHandler(routeNode, { ui: { clientId: "c1", action: { type: "navigate", params: { id: "42" } } } }, send, done);

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data.command).toMatchObject({ type: "navigate", to: "/customers/42" });
        // The push still updates the server's remembered location for the client.
        expect(t.runtimeState.streamClients.get(APP_ID).get("c1").location).toBe("/customers/42");
        // P112: the navigate path no longer emits onEnter — the full-reload →
        // connect path (handleClientArrival) owns the route lifecycle now.
        const enters = routeNode.send.mock.calls.map((c: any[]) => c[0]).filter((m: any) => m && m.ui && m.ui.event === "onEnter");
        expect(enters).toHaveLength(0);
        // The incoming msg is still passed through the output port.
        expect(send).toHaveBeenCalledTimes(1);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

describe("P66 Scenario 2: ui-app app-global navigate with a `to` template", () => {
    it("ui-app receiving navigate with `to` resolves the location and pushes navigate (P112: NO onEnter from the navigate path)", () => {
        const res = makeFakeRes();
        const appNode: any = { id: "appNode", send: vi.fn(), webappDefinition: { type: "ui-app", id: APP_ID, name: "Nav", root: APP_ID, layout: "vertical" } };
        registerDef(APP_ID, appNode.webappDefinition, appNode);
        const routeNode: any = { id: "routeNode", send: vi.fn(), webappDefinition: { type: "ui-route", id: "orders", path: "/orders/:oid", layout: "vertical", events: ["onEnter"] } };
        registerDef("routeNode", routeNode.webappDefinition, routeNode);
        t.runtimeState.RED = {
            nodes: { getNode: (id: string) => (id === "routeNode" ? routeNode : id === "appNode" ? appNode : undefined) },
            util: {}
        };
        t.addStreamClient(APP_ID, "c1", res, "/", "load-nav2");

        const appHandler = t.runtimeNodeRegistry["ui-app"].options.inputHandler;
        appHandler(appNode, { ui: { clientId: "c1", action: { type: "navigate", to: "/orders/:oid", params: { oid: "5" } } } }, vi.fn(), vi.fn());

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data.command).toMatchObject({ type: "navigate", to: "/orders/5" });
        // P112: no onEnter emitted from the navigate path on the entered route.
        const routeEnters = routeNode.send.mock.calls.map((c: any[]) => c[0]).filter((m: any) => m && m.ui && m.ui.event === "onEnter");
        expect(routeEnters).toHaveLength(0);
    });
});

// P118 (ADR 0011 §3): the old P66 validateNavigationFlow cross-checks
// (ambiguous / no-destination / dead-link) are REMOVED — the explicit
// target-source mode stores the intent, so the scan-based ambiguity rule is
// gegenstandslos and there is no scan-based deploy check. (See p118-navigate-
// target-modes.test.ts for the new mode behaviour.)

describe("P66: buildActionCommand resolves url-mode typedInput `to`", () => {
    it("a url-mode navigate with toType=msg resolves the destination from the message", () => {
        t.runtimeState.RED = {
            util: {
                evaluateNodeProperty: (value: string, _type: string, _node: unknown, msg: any) => msg[value]
            }
        };
        const node = { id: "act", webappDefinition: { type: "ui-action", id: "go", actionType: "navigate", targetMode: "url", to: "dest", toType: "msg" } };
        const command = t.buildActionCommand(node.webappDefinition, { dest: "/x/1" }, node);
        expect(command).toMatchObject({ type: "navigate", to: "/x/1" });
    });
});
