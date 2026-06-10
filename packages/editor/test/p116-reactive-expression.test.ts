import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P116 (ADR 0010) — unit coverage for the pure helpers behind the reactive
 * expression editor: the stage-1 syntax check, the stage-2 store("…") literal
 * scan + reference validation, and route-from-mount resolution.
 *
 * `resources/lib/editor-common.js` is a browser IIFE; these helpers are pure
 * (no jQuery / RED), so we load the file in a vm and assert on the exports —
 * the same loading pattern as the P113 value-binding test.
 */

interface Result {
    ok: boolean;
    error?: string;
}

interface RouteRef {
    id: string;
    path: string;
}

interface EditorCommon {
    validateReactiveSyntax: (src: unknown) => Result;
    scanReactiveStoreLiterals: (src: unknown) => string[];
    validateReactiveReferences: (src: unknown, storeNames: string[]) => Result;
    resolveRouteFromMount: (
        mount: string,
        references: { routes: RouteRef[]; containers: Array<{ id: string; mount: string }> }
    ) => RouteRef | null;
}

let common: EditorCommon;

beforeAll(() => {
    const editorCommonPath = fileURLToPath(
        new URL("../../../resources/lib/editor-common.js", import.meta.url)
    );
    const source = readFileSync(editorCommonPath, "utf8");
    const sandbox: Record<string, unknown> = {};
    sandbox.window = sandbox;
    createContext(sandbox);
    runInContext(source, sandbox);
    common = sandbox.WebappEditorCommon as EditorCommon;
});

describe("P116: stage-1 syntax validation", () => {
    it("accepts a valid template-literal expression", () => {
        expect(common.validateReactiveSyntax("`Kunde ${routeParam.id}`")).toEqual({ ok: true });
    });

    it("accepts a conditional/ternary expression", () => {
        const src = 'query("customers.total") > 0 ? `${query("customers.total")} Kunden` : "Keine Kunden"';
        expect(common.validateReactiveSyntax(src).ok).toBe(true);
    });

    it("rejects an empty / whitespace-only source", () => {
        expect(common.validateReactiveSyntax("").ok).toBe(false);
        expect(common.validateReactiveSyntax("   ").ok).toBe(false);
    });

    it("rejects a broken template literal (`Kunde ${`)", () => {
        const result = common.validateReactiveSyntax("`Kunde ${");
        expect(result.ok).toBe(false);
        expect(typeof result.error).toBe("string");
    });

    it("rejects a statement (not a single expression)", () => {
        // A `return`/assignment statement does not parse as `return ( <src> )`.
        expect(common.validateReactiveSyntax("var x = 1").ok).toBe(false);
    });
});

describe("P116: store(\"…\") literal scan (pure)", () => {
    it("extracts a single double-quoted store name", () => {
        expect(common.scanReactiveStoreLiterals('store("customer").name')).toEqual(["customer"]);
    });

    it("extracts single-quoted and whitespace-padded names", () => {
        expect(common.scanReactiveStoreLiterals("store( 'cart' )")).toEqual(["cart"]);
    });

    it("extracts multiple distinct literals in order", () => {
        const src = '`${store("a").x} ${store("b").y}`';
        expect(common.scanReactiveStoreLiterals(src)).toEqual(["a", "b"]);
    });

    it("skips dynamic (non-literal) store() calls", () => {
        expect(common.scanReactiveStoreLiterals("store(name).x")).toEqual([]);
    });

    it("returns [] for source with no store() calls", () => {
        expect(common.scanReactiveStoreLiterals("`Kunde ${routeParam.id}`")).toEqual([]);
    });
});

describe("P116: stage-2 reference validation", () => {
    it("passes when every store literal matches a known name", () => {
        expect(common.validateReactiveReferences('store("customer").name', ["customer", "cart"])).toEqual({ ok: true });
    });

    it("passes with no store literals regardless of store list", () => {
        expect(common.validateReactiveReferences("`Kunde ${routeParam.id}`", []).ok).toBe(true);
    });

    it("fails and names an unknown store", () => {
        const result = common.validateReactiveReferences('store("gibtsnicht").x', ["customer"]);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("gibtsnicht");
    });

    it("fails on an ambiguous (duplicate) store name", () => {
        const result = common.validateReactiveReferences('store("dup").x', ["dup", "dup"]);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("dup");
    });
});

describe("P116: resolveRouteFromMount", () => {
    const references = {
        routes: [{ id: "r1", path: "/customers/:id" }],
        containers: [{ id: "c1", mount: "route:/customers/:id/content" }]
    };

    it("resolves a direct route mount", () => {
        const route = common.resolveRouteFromMount("route:/customers/:id/content", references);
        expect(route && route.path).toBe("/customers/:id");
    });

    it("walks a container chain up to the enclosing route", () => {
        const route = common.resolveRouteFromMount("container:c1/content", references);
        expect(route && route.path).toBe("/customers/:id");
    });

    it("returns null for an app-slot mount (not under a route)", () => {
        expect(common.resolveRouteFromMount("app1.content", references)).toBeNull();
    });
});
