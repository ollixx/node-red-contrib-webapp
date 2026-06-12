import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
    };
};

const { runtimeNodeRegistry, renderAppPage } = webapp.__test__;

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...(reg.mapConfig(node) as Record<string, unknown>), z: node.z } : { ...node, id: node.id };
    });
}

/**
 * P157 (ADR 0012) — ui-menu Field-Typing Welle 2.
 *
 * `itemsPath` → `items`: canonical STRUCTURAL array value typedInput (the menu
 * renders its entries ITSELF — NOT a repeats/slot case). A json-literal binding
 * unwraps to a static array; a store/query/reactive binding passes through and is
 * resolved STRUCTURALLY by the renderer (the SAME path P133 added for ui-select
 * `options`, so an array slice is not rejected by the display-scalar guard).
 *
 * `activeRoutePath` → `activeRoute`: read-only value typedInput; the matching item
 * is highlighted. Both legacy paths migrate losslessly to `{kind:"state", path}`.
 */
describe("P157: ui-menu mapConfig — items (structural array) + activeRoute (read-only)", () => {
    const reg = runtimeNodeRegistry["ui-menu"];

    function mapMenu(config: Record<string, unknown>) {
        return reg.mapConfig({ id: "m1", mount: "app1.content", ...config }) as Record<string, unknown>;
    }

    it("json-literal items binding unwraps to a static array", () => {
        const items = [{ label: "Home", route: "/" }, { label: "Customers", route: "/customers" }];
        const def = mapMenu({ items: { kind: "literal", value: items } });
        expect(def.items).toEqual(items);
    });

    it("a store items binding passes through (structural resolution)", () => {
        const def = mapMenu({ items: { kind: "store", path: "nav", subPath: "items" } });
        expect(def.items).toEqual({ kind: "store", path: "nav", subPath: "items" });
    });

    it("a query items binding passes through", () => {
        const def = mapMenu({ items: { kind: "query", path: "menu.entries" } });
        expect(def.items).toEqual({ kind: "query", path: "menu.entries" });
    });

    it("a bare JSON string (legacy / flow.json) parses to a static array", () => {
        const def = mapMenu({ items: JSON.stringify([{ label: "A", route: "/a" }]) });
        expect(def.items).toEqual([{ label: "A", route: "/a" }]);
    });

    it("migration — legacy itemsPath becomes a state binding", () => {
        const def = mapMenu({ itemsPath: "nav.items" });
        expect(def.items).toEqual({ kind: "state", path: "nav.items" });
    });

    it("activeRoute binding object drives activeItem", () => {
        const def = mapMenu({ items: { kind: "literal", value: [] }, activeRoute: { kind: "store", path: "nav", subPath: "active" } });
        expect(def.activeItem).toEqual({ kind: "store", path: "nav", subPath: "active" });
    });

    it("migration — legacy activeRoutePath becomes a state binding on activeItem", () => {
        const def = mapMenu({ items: { kind: "literal", value: [] }, activeRoutePath: "nav.activeRoute" });
        expect(def.activeItem).toEqual({ kind: "state", path: "nav.activeRoute" });
    });

    it("no activeRoute / activeRoutePath → activeItem undefined", () => {
        const def = mapMenu({ items: { kind: "literal", value: [] } });
        expect(def.activeItem).toBeUndefined();
    });
});

/**
 * Render-resolution end to end: a bound (store/query/literal) items array renders
 * the sl-menu entries, and an activeRoute binding marks the matching item active.
 */
describe("P157: ui-menu — structural items render + activeRoute highlight", () => {
    it("a store items array renders the menu entries reactively", () => {
        const items = [{ label: "Home", route: "/" }, { label: "Customers", route: "/customers" }];
        const definitions = buildDefinitions([
            { type: "ui-app", id: "mApp1", name: "Menu", root: "mApp1", layout: "app", z: "f1" },
            { type: "ui-store", id: "mStore1", statePath: "nav", initialValue: JSON.stringify({ items }), z: "f1" },
            { type: "ui-menu", id: "mNode1", mount: "mApp1.content", items: { kind: "store", path: "mStore1", subPath: { kind: "literal", value: "items" } }, z: "f1" }
        ]);

        const result = renderAppPage("mApp1", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("<sl-menu>");
        expect(result.body).toContain(">Home</sl-menu-item>");
        expect(result.body).toContain(">Customers</sl-menu-item>");
        expect(result.body).toContain("data-webapp-navigate-path=\"/customers\"");
    });

    it("a json-literal items array renders the menu entries", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "mApp2", name: "Menu", root: "mApp2", layout: "app", z: "f1" },
            { type: "ui-menu", id: "mNode2", mount: "mApp2.content", items: { kind: "literal", value: [{ label: "Dashboard", route: "/dashboard" }] }, z: "f1" }
        ]);

        const result = renderAppPage("mApp2", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain(">Dashboard</sl-menu-item>");
        expect(result.body).toContain("data-webapp-navigate-path=\"/dashboard\"");
    });

    it("activeRoute from a store marks the matching item active (aria-current)", () => {
        const items = [{ label: "Home", route: "/" }, { label: "Customers", route: "/customers" }];
        const definitions = buildDefinitions([
            { type: "ui-app", id: "mApp3", name: "Menu", root: "mApp3", layout: "app", z: "f1" },
            { type: "ui-store", id: "mStore3", statePath: "nav", initialValue: JSON.stringify({ active: "/customers" }), z: "f1" },
            {
                type: "ui-menu",
                id: "mNode3",
                mount: "mApp3.content",
                items: { kind: "literal", value: items },
                activeRoute: { kind: "store", path: "mStore3", subPath: { kind: "literal", value: "active" } },
                z: "f1"
            }
        ]);

        const result = renderAppPage("mApp3", "/", undefined, definitions);
        expect(result.status).toBe(200);
        // exactly the "/customers" item carries the active markers
        expect(result.body).toContain("data-webapp-navigate-path=\"/customers\" data-webapp-active=\"true\" aria-current=\"page\"");
        // "/" (Home) is NOT marked active
        expect(result.body).not.toContain("data-webapp-navigate-path=\"/\" data-webapp-active=\"true\"");
    });

    it("no activeRoute → no item carries the active markers", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "mApp4", name: "Menu", root: "mApp4", layout: "app", z: "f1" },
            { type: "ui-menu", id: "mNode4", mount: "mApp4.content", items: { kind: "literal", value: [{ label: "Home", route: "/" }] }, z: "f1" }
        ]);

        const result = renderAppPage("mApp4", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).not.toContain("data-webapp-active");
    });

    it("a legacy itemsPath still renders the menu entries from the store", () => {
        const items = [{ label: "Reports", route: "/reports" }];
        const definitions = buildDefinitions([
            { type: "ui-app", id: "mApp5", name: "Menu", root: "mApp5", layout: "app", z: "f1" },
            { type: "ui-store", id: "mStore5", statePath: "nav", initialValue: JSON.stringify({ items }), z: "f1" },
            { type: "ui-menu", id: "mNode5", mount: "mApp5.content", itemsPath: "nav.items", z: "f1" }
        ]);

        const result = renderAppPage("mApp5", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain(">Reports</sl-menu-item>");
    });
});
