import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P66 (ADR 0007) — ui-action / ui-route / ui-app navigation.
 *
 * Two navigate scenarios:
 *   1. wired-to-route: the action carries params; the wired ui-route builds the
 *      location from its OWN path + params (no `to` on the action).
 *   2. path typedInput: the action carries a `to` (str/msg/flow/global/jsonata);
 *      app-global navigate resolves the template at the ui-app.
 * onEnter is emitted on route entry in BOTH scenarios. Cross-validation
 * (ambiguity / no-destination / dead-link) is a runtime/compile check.
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

describe("P66 Scenario 1: ui-route navigate handler (own path + params + onEnter)", () => {
    it("a navigate wired to a ui-route builds the location from the route path and pushes navigate", () => {
        const res = makeFakeRes();
        registerDef(APP_ID, { type: "ui-app", id: APP_ID, title: "Nav", layout: "vertical" });
        const routeNode: any = { id: "routeNode", send: vi.fn(), webappDefinition: { type: "ui-route", id: "customerDetail", path: "/customers/:id", layout: "vertical", events: ["onEnter"] } };
        registerDef("routeNode", routeNode.webappDefinition, routeNode);
        t.runtimeState.RED = { nodes: { getNode: (id: string) => (id === "routeNode" ? routeNode : undefined) } };
        t.addStreamClient(APP_ID, "c1", res, "/");

        const routeHandler = t.runtimeNodeRegistry["ui-route"].options.inputHandler;
        const send = vi.fn();
        const done = vi.fn();
        routeHandler(routeNode, { ui: { clientId: "c1", action: { type: "navigate", params: { id: "42" } } } }, send, done);

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data.command).toMatchObject({ type: "navigate", to: "/customers/42" });
        // The server remembered the new location for the client.
        expect(t.runtimeState.streamClients.get(APP_ID).get("c1").location).toBe("/customers/42");
        // onEnter emitted on the route node (it declares the event).
        expect(routeNode.send).toHaveBeenCalled();
        const emitted = routeNode.send.mock.calls[routeNode.send.mock.calls.length - 1][0];
        expect(emitted.ui.event).toBe("onEnter");
        expect(emitted.ui.route).toBe("/customers/42");
        expect(emitted.ui.params).toMatchObject({ id: "42" });
        // The incoming msg is still passed through the output port.
        expect(send).toHaveBeenCalledTimes(1);
        expect(done).toHaveBeenCalledTimes(1);
    });
});

describe("P66 Scenario 2: ui-app app-global navigate with a `to` template", () => {
    it("ui-app receiving navigate with `to` resolves the location and pushes navigate + onEnter on the target route", () => {
        const res = makeFakeRes();
        const appNode: any = { id: "appNode", send: vi.fn(), webappDefinition: { type: "ui-app", id: APP_ID, title: "Nav", layout: "vertical" } };
        registerDef(APP_ID, appNode.webappDefinition, appNode);
        const routeNode: any = { id: "routeNode", send: vi.fn(), webappDefinition: { type: "ui-route", id: "orders", path: "/orders/:oid", layout: "vertical", events: ["onEnter"] } };
        registerDef("routeNode", routeNode.webappDefinition, routeNode);
        t.runtimeState.RED = {
            nodes: { getNode: (id: string) => (id === "routeNode" ? routeNode : id === "appNode" ? appNode : undefined) },
            util: {}
        };
        t.addStreamClient(APP_ID, "c1", res, "/");

        const appHandler = t.runtimeNodeRegistry["ui-app"].options.inputHandler;
        appHandler(appNode, { ui: { clientId: "c1", action: { type: "navigate", to: "/orders/:oid", params: { oid: "5" } } } }, vi.fn(), vi.fn());

        const commands = res.events().filter((e) => e.event === "command");
        expect(commands).toHaveLength(1);
        expect(commands[0].data.command).toMatchObject({ type: "navigate", to: "/orders/5" });
        // onEnter fires on the entered route (resolved by location), not the app.
        expect(routeNode.send).toHaveBeenCalled();
        const emitted = routeNode.send.mock.calls[routeNode.send.mock.calls.length - 1][0];
        expect(emitted.ui.event).toBe("onEnter");
        expect(emitted.ui.route).toBe("/orders/5");
    });
});

describe("P66: validateNavigationFlow cross-checks (full flow graph)", () => {
    function withFlow(nodes: unknown[], run: () => void) {
        const fs = require("node:fs");
        const os = require("node:os");
        const pathMod = require("node:path");
        const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), "p66-"));
        const flowFile = pathMod.join(dir, "flows.json");
        fs.writeFileSync(flowFile, JSON.stringify(nodes));
        t.runtimeState.RED = { settings: { flowFile, userDir: dir } };
        try {
            run();
        }
        finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    it("flags a navigate action wired to a ui-route AND carrying `to` (ambiguous)", () => {
        withFlow(
            [
                { id: "app1", type: "ui-app", uiId: "navApp", root: "navApp" },
                { id: "rt1", type: "ui-route", uiId: "customers", path: "/customers" },
                { id: "act1", type: "ui-action", uiId: "go", actionType: "navigate", to: "/customers", toType: "str", wires: [["rt1"]] }
            ],
            () => {
                const issues = t.validateNavigationFlow(t.runtimeState.RED);
                expect(issues.some((i: any) => /ambiguous/i.test(i.message))).toBe(true);
            }
        );
    });

    it("flags a navigate action with neither a wire-to-route nor a `to` (no destination)", () => {
        withFlow(
            [
                { id: "app1", type: "ui-app", uiId: "navApp", root: "navApp" },
                { id: "act1", type: "ui-action", uiId: "go", actionType: "navigate", wires: [[]] }
            ],
            () => {
                const issues = t.validateNavigationFlow(t.runtimeState.RED);
                expect(issues.some((i: any) => /no destination/i.test(i.message))).toBe(true);
            }
        );
    });

    it("flags a navigate with a STATIC `to` matching no ui-route (dead link)", () => {
        withFlow(
            [
                { id: "app1", type: "ui-app", uiId: "navApp", root: "navApp" },
                { id: "rt1", type: "ui-route", uiId: "customers", path: "/customers" },
                { id: "act1", type: "ui-action", uiId: "go", actionType: "navigate", to: "/nowhere", toType: "str", wires: [[]] }
            ],
            () => {
                const issues = t.validateNavigationFlow(t.runtimeState.RED);
                expect(issues.some((i: any) => /dead link/i.test(i.message))).toBe(true);
            }
        );
    });

    it("does NOT flag a dynamic `to` (msg/jsonata) — not edit-time checkable", () => {
        withFlow(
            [
                { id: "app1", type: "ui-app", uiId: "navApp", root: "navApp" },
                { id: "act1", type: "ui-action", uiId: "go", actionType: "navigate", to: "dest", toType: "msg", wires: [[]] }
            ],
            () => {
                const issues = t.validateNavigationFlow(t.runtimeState.RED);
                expect(issues).toHaveLength(0);
            }
        );
    });

    it("accepts a valid Scenario 1 (wired to a route, no `to`) with no issues", () => {
        withFlow(
            [
                { id: "app1", type: "ui-app", uiId: "navApp", root: "navApp" },
                { id: "rt1", type: "ui-route", uiId: "customers", path: "/customers/:id" },
                { id: "act1", type: "ui-action", uiId: "go", actionType: "navigate", params: { id: "rowId" }, wires: [["rt1"]] }
            ],
            () => {
                const issues = t.validateNavigationFlow(t.runtimeState.RED);
                expect(issues).toHaveLength(0);
            }
        );
    });

    it("accepts a matching static `to` against a parameterised route", () => {
        withFlow(
            [
                { id: "app1", type: "ui-app", uiId: "navApp", root: "navApp" },
                { id: "rt1", type: "ui-route", uiId: "customers", path: "/customers/:id" },
                { id: "act1", type: "ui-action", uiId: "go", actionType: "navigate", to: "/customers/42", toType: "str", wires: [[]] }
            ],
            () => {
                const issues = t.validateNavigationFlow(t.runtimeState.RED);
                expect(issues).toHaveLength(0);
            }
        );
    });
});

describe("P66: buildActionCommand resolves typedInput `to` + merges params", () => {
    it("a navigate ui-action with toType=msg resolves the destination from the message", () => {
        t.runtimeState.RED = {
            util: {
                evaluateNodeProperty: (value: string, _type: string, _node: unknown, msg: any) => msg[value]
            }
        };
        const node = { id: "act", webappDefinition: { type: "ui-action", id: "go", actionType: "navigate", to: "dest", toType: "msg" } };
        const command = t.buildActionCommand(node.webappDefinition, { dest: "/x/1" }, node);
        expect(command).toMatchObject({ type: "navigate", to: "/x/1" });
    });

    it("merges config params with msg.ui.action.params (msg wins per key)", () => {
        t.runtimeState.RED = { util: {} };
        const node = { id: "act", webappDefinition: { type: "ui-action", id: "go", actionType: "navigate", params: { a: "1", b: "2" } } };
        const command = t.buildActionCommand(node.webappDefinition, { ui: { action: { params: { b: "9" } } } }, node);
        expect(command.params).toEqual({ a: "1", b: "9" });
    });
});
