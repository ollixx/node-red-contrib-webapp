import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P118 (ADR 0011) — navigate target-source modes (wire | route | url) in the
 * runtime: typed param resolution, route-id → path resolution, the
 * addressing-precedence rule (an addressed navigation is passed through by a
 * receiving ui-route), and the legacy-config migration shim.
 */

const require = createRequire(import.meta.url);

/* eslint-disable @typescript-eslint/no-explicit-any */
const webapp = require("../../../nodes/webapp.js") as { __test__: any };
const t = webapp.__test__;

function registerDef(nodeId: string, definition: Record<string, unknown>, node?: unknown) {
    t.runtimeState.definitions.set(nodeId, {
        nodeId,
        appId: definition.type === "ui-app" ? definition.id : undefined,
        definition,
        _node: node
    });
}

beforeEach(() => {
    t.runtimeState.definitions.clear();
});

afterEach(() => {
    t.runtimeState.RED = undefined;
});

describe("P118: deriveNavigateTargetMode (migration shim)", () => {
    it("honours an explicit stored mode", () => {
        expect(t.deriveNavigateTargetMode({ actionType: "navigate", targetMode: "route", routeId: "r" })).toBe("route");
        expect(t.deriveNavigateTargetMode({ actionType: "navigate", targetMode: "wire" })).toBe("wire");
    });

    it("legacy config with `to` migrates to url mode", () => {
        expect(t.deriveNavigateTargetMode({ actionType: "navigate", to: "/customers" })).toBe("url");
    });

    it("legacy config with a routeId migrates to route mode", () => {
        expect(t.deriveNavigateTargetMode({ actionType: "navigate", routeId: "r1" })).toBe("route");
    });

    it("legacy config with neither migrates to wire mode", () => {
        expect(t.deriveNavigateTargetMode({ actionType: "navigate" })).toBe("wire");
    });

    it("non-navigate actions have no target mode", () => {
        expect(t.deriveNavigateTargetMode({ actionType: "show" })).toBeUndefined();
    });
});

describe("P118: parseActionParamList (migration of legacy params object)", () => {
    it("passes a typed list through unchanged", () => {
        const list = [{ name: "id", value: "payload.id", valueType: "msg" }];
        expect(t.parseActionParamList(list)).toEqual(list);
    });

    it("migrates a legacy `{k: v}` object to str-typed rows", () => {
        expect(t.parseActionParamList({ id: "42", tab: "orders" })).toEqual([
            { name: "id", value: "42", valueType: "str" },
            { name: "tab", value: "orders", valueType: "str" }
        ]);
    });

    it("defaults an unknown valueType to str", () => {
        expect(t.parseActionParamList([{ name: "id", value: "x", valueType: "bogus" }])).toEqual([
            { name: "id", value: "x", valueType: "str" }
        ]);
    });

    it("returns undefined for empty input", () => {
        expect(t.parseActionParamList(undefined)).toBeUndefined();
        expect(t.parseActionParamList([])).toBeUndefined();
    });
});

describe("P118: resolveActionParamRecord (typed param evaluation)", () => {
    it("resolves str / msg / jsonata / flow / global / env against the msg + context", () => {
        t.runtimeState.RED = {
            util: {
                evaluateNodeProperty: (value: string, type: string, _node: unknown, msg: any) => {
                    if (type === "msg") {
                        return value.split(".").reduce((acc: any, k: string) => (acc ? acc[k] : undefined), msg);
                    }
                    if (type === "flow") {
                        return "F";
                    }
                    if (type === "global") {
                        return "G";
                    }
                    if (type === "env") {
                        return "E";
                    }
                    return undefined;
                },
                prepareJSONataExpression: (expr: string) => ({ expr }),
                evaluateJSONataExpression: (prepared: any, msg: any) => `${msg.payload.id}!`
            }
        };
        const list = [
            { name: "a", value: "lit", valueType: "str" },
            { name: "b", value: "payload.id", valueType: "msg" },
            { name: "c", value: "payload.id & '!'", valueType: "jsonata" },
            { name: "d", value: "f", valueType: "flow" },
            { name: "e", value: "g", valueType: "global" },
            { name: "f", value: "HOME", valueType: "env" }
        ];
        const record = t.resolveActionParamRecord({ id: "n" }, list, { payload: { id: "42" } });
        expect(record).toEqual({ a: "lit", b: "42", c: "42!", d: "F", e: "G", f: "E" });
    });

    it("returns undefined for an empty list", () => {
        expect(t.resolveActionParamRecord({ id: "n" }, [], {})).toBeUndefined();
    });
});

describe("P118: resolveRouteIdToPath (route mode)", () => {
    it("resolves a referenced ui-route id to its declared path", () => {
        registerDef("rn", { type: "ui-route", id: "customerDetail", path: "/customers/:id" });
        expect(t.resolveRouteIdToPath("customerDetail")).toBe("/customers/:id");
    });

    it("resolves a ui-app id to the implicit root", () => {
        registerDef("an", { type: "ui-app", id: "app1" });
        expect(t.resolveRouteIdToPath("app1")).toBe("/");
    });

    it("returns undefined for an unknown id", () => {
        expect(t.resolveRouteIdToPath("nope")).toBeUndefined();
    });
});

describe("P118: buildActionCommand — route mode builds an explicit addressed `to`", () => {
    it("resolves routeId → path and fills :placeholders from typed params (msg)", () => {
        t.runtimeState.RED = {
            util: {
                evaluateNodeProperty: (value: string, _type: string, _node: unknown, msg: any) =>
                    value.split(".").reduce((acc: any, k: string) => (acc ? acc[k] : undefined), msg)
            }
        };
        registerDef("rn", { type: "ui-route", id: "customerDetail", path: "/customers/:id" });
        const def = {
            type: "ui-action",
            id: "go",
            actionType: "navigate",
            targetMode: "route",
            routeId: "customerDetail",
            params: [{ name: "id", value: "payload.id", valueType: "msg" }]
        };
        const command = t.buildActionCommand(def, { payload: { id: "42" } }, { id: "go" });
        expect(command).toMatchObject({ type: "navigate", to: "/customers/42" });
    });

    it("wire mode carries NO explicit `to` (the receiving route supplies the path)", () => {
        const def = { type: "ui-action", id: "go", actionType: "navigate", targetMode: "wire" };
        const command = t.buildActionCommand(def, { payload: {} }, { id: "go" });
        expect(command.type).toBe("navigate");
        expect(command.to).toBeUndefined();
    });
});

describe("P118: resolveNavigateLocation — addressing precedence (ADR 0011 §3)", () => {
    it("passes an ADDRESSED navigation through a ui-route unchanged (route does NOT impose its own path)", () => {
        // The route's own path is /other, but the incoming action already carries
        // an explicit /customers/42 — the route must NOT hijack it.
        const routeNode = { id: "rn", webappDefinition: { type: "ui-route", id: "other", path: "/other" } };
        const location = t.resolveNavigateLocation(routeNode, { type: "navigate", to: "/customers/42" });
        expect(location).toBe("/customers/42");
    });

    it("a target-LESS navigate (wire mode) still uses the receiving route's own path", () => {
        const routeNode = { id: "rn", webappDefinition: { type: "ui-route", id: "customerDetail", path: "/customers/:id" } };
        const location = t.resolveNavigateLocation(routeNode, { type: "navigate", params: { id: "7" } });
        expect(location).toBe("/customers/7");
    });
});
