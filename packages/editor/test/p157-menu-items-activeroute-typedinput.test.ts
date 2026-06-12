import { describe, expect, it } from "vitest";

import { emitNodeDefinition } from "../src";

/**
 * P157 (ADR 0012) — ui-menu Field-Typing Welle 2: `items` becomes a canonical
 * STRUCTURAL array value typedInput (store/query/reactive/json-literal) and
 * `activeRoute` a read-only canonical value typedInput. The editor mapper
 * (emitNodeDefinition) compiles those binding objects into the schema
 * `items` / `activeItem` fields, migrating the legacy `itemsPath` /
 * `activeRoutePath` plain state paths to `{ kind:"state", path }`.
 */
function mapMenu(config: Record<string, unknown>) {
    const result = emitNodeDefinition("ui-menu", { id: "m1", mount: "route:/x/content", ...config } as never);
    if (!result.success) {
        throw new Error("ui-menu emit failed: " + result.error);
    }
    return result.data as unknown as {
        type: string;
        items: unknown;
        activeItem: unknown;
    };
}

describe("P157: ui-menu editor mapper — items (structural array) + activeRoute (read-only)", () => {
    it("json-literal items binding is unwrapped to a static array", () => {
        const items = [
            { label: "Home", route: "/" },
            { label: "Customers", route: "/customers" }
        ];
        const def = mapMenu({ items: { kind: "literal", value: items } });
        expect(def.items).toEqual(items);
    });

    it("a store items binding passes through unchanged (structural resolution)", () => {
        const sub = { kind: "store", path: "nav", subPath: { kind: "literal", value: "items" } };
        const def = mapMenu({ items: sub });
        expect(def.items).toEqual(sub);
    });

    it("a query items binding passes through unchanged", () => {
        const def = mapMenu({ items: { kind: "query", path: "menu.entries" } });
        expect(def.items).toEqual({ kind: "query", path: "menu.entries" });
    });

    it("a bare array (flow.json/tests) is kept as a static array", () => {
        const items = [{ label: "A", route: "/a" }];
        const def = mapMenu({ items });
        expect(def.items).toEqual(items);
    });

    it("migration — legacy itemsPath plain state path becomes a state binding", () => {
        const def = mapMenu({ itemsPath: "nav.items" });
        expect(def.items).toEqual({ kind: "state", path: "nav.items" });
    });

    it("activeRoute binding object passes through to activeItem", () => {
        const active = { kind: "store", path: "nav", subPath: { kind: "literal", value: "active" } };
        const def = mapMenu({
            items: { kind: "literal", value: [{ label: "A", route: "/a" }] },
            activeRoute: active
        });
        expect(def.activeItem).toEqual(active);
    });

    it("migration — legacy activeRoutePath plain state path becomes a state binding on activeItem", () => {
        const def = mapMenu({
            items: { kind: "literal", value: [{ label: "A", route: "/a" }] },
            activeRoutePath: "nav.activeRoute"
        });
        expect(def.activeItem).toEqual({ kind: "state", path: "nav.activeRoute" });
    });

    it("no activeRoute / activeRoutePath → activeItem undefined", () => {
        const def = mapMenu({ items: { kind: "literal", value: [{ label: "A", route: "/a" }] } });
        expect(def.activeItem).toBeUndefined();
    });
});
