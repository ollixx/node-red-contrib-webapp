import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import { __resetReactiveCache, createRendererApp, findComponentInSnapshot } from "../src";

/**
 * P131 (ADR 0013) — renderer half of the `store` binding `subPath`.
 *
 * A `store` binding may carry a one-level leaf sub-path that resolves to a path
 * string / numeric index into the store slice; the renderer then reads
 * `getValueAtPath(slice, path)`. Unresolvable paths and object slices bound
 * without a sub-path resolve to the invalid-value marker ("?") and report a
 * single speaking error through the existing reactive-error sink.
 */

beforeEach(() => {
    __resetReactiveCache();
});

// A minimal app: one route, one layout slot, one ui-text whose `value` is a
// store binding (optionally with a sub-path). The "monster" store's slice is the
// owner's motivating example {a:false, b:false, c:"eins"}.
function appWithStoreText(valueBinding: BindingDefinition): AppModel {
    return {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "storeText",
                kind: "text",
                mount: "route:/home/content",
                bind: { value: valueBinding },
                props: {},
                events: []
            }
        ]
    };
}

function integrationWith(statePath: string, name = "monster"): RuntimeIntegrationModel {
    return {
        stores: [{ id: "monsterStore", name, statePath }],
        queries: [],
        actions: [],
        navigations: []
    };
}

function textOf(app: ReturnType<typeof createRendererApp>): string | undefined {
    const text = findComponentInSnapshot(app.render(), "storeText");
    return text && "text" in text ? text.text : undefined;
}

describe("P131 store subPath — happy path", () => {
    it("literal sub-path 'c' on an object slice → the property value 'eins'", () => {
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "c" } }),
            {
                integration: integrationWith("monster"),
                state: { monster: { a: false, b: false, c: "eins" } }
            }
        );

        expect(textOf(app)).toBe("eins");
    });

    it("literal numeric sub-path 0 on an array slice → element 0", () => {
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: 0 } }),
            {
                integration: integrationWith("items"),
                state: { items: ["alpha", "beta", "gamma"] }
            }
        );

        expect(textOf(app)).toBe("alpha");
    });

    it("nested dotted sub-path 'b.label' resolves into the slice", () => {
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "b.label" } }),
            {
                integration: integrationWith("monster"),
                state: { monster: { b: { label: "Beta" } } }
            }
        );

        expect(textOf(app)).toBe("Beta");
    });
});

describe("P131 store subPath — dynamic path", () => {
    it("routeParam sub-path resolves the param value as the path", () => {
        const model = appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "routeParam", path: "key" } });
        // route with a :key param; mount the text against that route path.
        model.routes = [{ id: "home", path: "/p/:key", layoutId: "main" }];
        model.components[0].mount = "route:/p/:key/content";

        const app = createRendererApp(model, {
            integration: integrationWith("monster"),
            location: "/p/c",
            state: { monster: { a: false, b: false, c: "eins" } }
        });

        expect(textOf(app)).toBe("eins");
    });

    it("reactive sub-path resolves a computed path string", () => {
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "reactive", value: "`c`" } }),
            {
                integration: integrationWith("monster"),
                state: { monster: { a: false, b: false, c: "eins" } }
            }
        );

        expect(textOf(app)).toBe("eins");
    });
});

describe("P131 store subPath — empty / missing sub-path", () => {
    it("scalar slice without a sub-path → the scalar itself", () => {
        const app = createRendererApp(appWithStoreText({ kind: "store", path: "monsterStore" }), {
            integration: integrationWith("scalar"),
            state: { scalar: "hello" }
        });

        expect(textOf(app)).toBe("hello");
    });

    it("object slice without a sub-path → invalid-value marker + one speaking error", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(appWithStoreText({ kind: "store", path: "monsterStore" }), {
            integration: integrationWith("monster"),
            state: { monster: { a: false, b: false, c: "eins" } },
            onReactiveError
        });

        expect(textOf(app)).toBe("?");
        // re-render must not re-report (dedup)
        app.render();
        expect(onReactiveError).toHaveBeenCalledTimes(1);
        expect(onReactiveError.mock.calls[0][0].message).toContain('Store "monster": Wert ist ein Objekt');
    });
});

// ADR 0032 (refines 0013): a missing key in an OBJECT/ARRAY slice is a transient
// "not yet populated" value (e.g. an entity's `_id` before it is saved), NOT a
// misconfiguration — the binding resolves EMPTY and reports NOTHING. Only a
// sub-path against a SCALAR slice stays a real (config) error.
describe("P131/ADR-0032 store subPath — missing key in an object/array slice is transient, not an error", () => {
    it("missing key in an OBJECT slice → resolves empty; NO error reported; snapshot intact", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "x" } }),
            {
                integration: integrationWith("monster"),
                state: { monster: { a: false, b: false, c: "eins" } },
                onReactiveError
            }
        );

        const snapshot = app.render();
        expect(findComponentInSnapshot(snapshot, "storeText")).toBeDefined();
        expect(textOf(app)).toBe("");
        expect(onReactiveError).not.toHaveBeenCalled();
    });

    it("out-of-range index on an ARRAY slice → resolves empty; NO error reported", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: 9 } }),
            {
                integration: integrationWith("items"),
                state: { items: ["a", "b"] },
                onReactiveError
            }
        );

        expect(textOf(app)).toBe("");
        expect(onReactiveError).not.toHaveBeenCalled();
    });
});

describe("P131 store subPath — a sub-path against a SCALAR slice stays a speaking error", () => {
    it("sub-path against a scalar slice → invalid-value marker + speaking error mentioning the scalar", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "c" } }),
            {
                integration: integrationWith("scalar"),
                state: { scalar: "eins" },
                onReactiveError
            }
        );

        expect(textOf(app)).toBe("?");
        expect(onReactiveError).toHaveBeenCalled();
        expect(onReactiveError.mock.calls[0][0].message).toContain('der String "eins"');
    });

    it("ADR 0032: the reported store sub-path error carries the offending node id + warn severity", () => {
        const onReactiveError = vi.fn();
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "c" } }),
            {
                integration: integrationWith("scalar"),
                state: { scalar: "eins" },
                onReactiveError
            }
        );

        app.render();
        expect(onReactiveError.mock.calls[0][0].nodeId).toBe("storeText");
        expect(onReactiveError.mock.calls[0][0].severity).toBe("warn");
    });
});

describe("P131 store subPath — recursion guard (schema-bypass construct)", () => {
    it("a deeply nested sub-path chain trips the depth guard → marker + one error, no crash", () => {
        const onReactiveError = vi.fn();

        // Build a self-referential sub-path chain that the SCHEMA would reject
        // (subPath.subPath). The renderer must not overflow the stack — the depth
        // guard returns the invalid-value marker and reports one speaking error.
        const leaf: Record<string, unknown> = { kind: "store", path: "monsterStore", subPath: { kind: "literal", value: "c" } };
        leaf.subPath = leaf; // cycle

        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "monsterStore", subPath: leaf } as unknown as BindingDefinition),
            {
                integration: integrationWith("monster"),
                state: { monster: { a: false, b: false, c: "eins" } },
                onReactiveError
            }
        );

        expect(() => app.render()).not.toThrow();
        expect(textOf(app)).toBe("?");
        expect(onReactiveError).toHaveBeenCalled();
        expect(
            onReactiveError.mock.calls.some((call) => String(call[0].message).includes("nesting too deep / cycle"))
        ).toBe(true);
    });
});
