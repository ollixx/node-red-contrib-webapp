import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    evaluateReactiveExpression,
    type RenderedComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P196 (renderer, ADR 0023 §3) — the namespaced reactive `scope(name)` accessor.
 * Inside a `reactive` expression, `scope("customer")` returns the item of the
 * ENCLOSING `ui-repeat` NAMED `customer` (`itemName`), so `scope("customer").name`
 * reads an OUTER element past inner repeats — the reactive twin of the P193
 * `{kind:item, scope:"customer"}` binding. A non-enclosing/absent name → undefined
 * (no throw). Per-instance: each clone gets its own named frames.
 *
 * Snapshot tests are the unit acceptance; the browser proof is the orchestrator's
 * E2E (`tests/e2e/nodes/view/ui-repeat.spec.ts`).
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

function allTexts(app: ReturnType<typeof createRendererApp>): string[] {
    const snapshot = app.render();
    const out: string[] = [];
    const walk = (components: RenderedComponent[]): void => {
        for (const component of components) {
            if (component.kind === "text") {
                out.push((component as RenderedTextComponent).text);
            }
            if ("regions" in component && Array.isArray((component as { regions?: unknown[] }).regions)) {
                for (const region of (component as { regions: { components: RenderedComponent[] }[] }).regions) {
                    walk(region.components);
                }
            }
        }
    };
    for (const region of snapshot.regions) {
        walk(region.components);
    }
    return out;
}

// Two customers, each with two orders — the same fixture shape as the P193
// binding test, addressed here via the reactive `scope()` accessor instead.
const CUSTOMERS = [
    { id: "c1", name: "Ada", orders: [{ total: 10 }, { total: 20 }] },
    { id: "c2", name: "Linus", orders: [{ total: 30 }, { total: 40 }] }
];

describe("P196 — reactive scope() resolves named enclosing repeats per-instance", () => {
    // outer ui-repeat(itemName=customer) → inner ui-repeat(itemName=order) → a deep
    // ui-text whose reactive expression reads BOTH levels by name:
    //   `${scope("customer").name}: ${scope("order").total}`
    function app(): AppModel {
        return {
            id: "app",
            name: "App",
            layouts: [{ id: "main", slots: [{ name: "content" }] }],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "outer",
                    kind: "repeat",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { items: { kind: "literal", value: CUSTOMERS } },
                    props: { keyField: "id", itemName: "customer" },
                    events: []
                },
                {
                    id: "inner",
                    kind: "repeat",
                    mount: "container:outer/content",
                    order: 0,
                    // inner items = the customer's orders — via the P193 scoped binding.
                    bind: { items: { kind: "item", scope: "customer", path: "orders" } },
                    props: { itemName: "order" },
                    events: []
                },
                {
                    id: "deep",
                    kind: "text",
                    mount: "container:inner/content",
                    order: 0,
                    // reactive: reach the OUTER customer AND the INNER order by name.
                    bind: {
                        value: {
                            kind: "reactive",
                            value: "`${scope(\"customer\").name}: ${scope(\"order\").total}`"
                        }
                    },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("scope(\"customer\").name reaches the OUTER row and scope(\"order\").total the inner — per instance", () => {
        const rendered = createRendererApp(app(), { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual([
            "Ada: 10",
            "Ada: 20",
            "Linus: 30",
            "Linus: 40"
        ]);
    });

    it("an inner same-named scope SHADOWS an outer one (innermost wins)", () => {
        const model: AppModel = {
            id: "app",
            name: "App",
            layouts: [{ id: "main", slots: [{ name: "content" }] }],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "outer",
                    kind: "repeat",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { items: { kind: "literal", value: [{ id: "o", kids: [{ v: "inner" }] }] } },
                    props: { keyField: "id", itemName: "row" },
                    events: []
                },
                {
                    id: "inner",
                    kind: "repeat",
                    mount: "container:outer/content",
                    order: 0,
                    bind: { items: { kind: "item", scope: "row", path: "kids" } },
                    props: { itemName: "row" },
                    events: []
                },
                {
                    id: "t",
                    kind: "text",
                    mount: "container:inner/content",
                    order: 0,
                    bind: { value: { kind: "reactive", value: "scope(\"row\").v" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual(["inner"]);
    });
});

describe("P196 — scope() outside a matching name is undefined (no throw)", () => {
    it("a non-enclosing scope name yields undefined and reports NO reactive error", () => {
        const reactiveErrors: unknown[] = [];
        const model: AppModel = {
            id: "app",
            name: "App",
            layouts: [{ id: "main", slots: [{ name: "content" }] }],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "rep",
                    kind: "repeat",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { items: { kind: "literal", value: [{ id: "a", name: "Ada" }] } },
                    props: { keyField: "id", itemName: "customer" },
                    events: []
                },
                {
                    id: "t",
                    kind: "text",
                    mount: "container:rep/content",
                    order: 0,
                    // "nope" is not an enclosing repeat → scope("nope") is undefined.
                    bind: { value: { kind: "reactive", value: "String(scope(\"nope\"))" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, {
            integration: NO_INTEGRATION,
            onReactiveError: (error) => reactiveErrors.push(error)
        });
        expect(allTexts(rendered)).toEqual(["undefined"]);
        expect(reactiveErrors).toEqual([]);
    });

    it("OUTSIDE any repeat, scope(name) is undefined (no throw)", () => {
        // Direct evaluator test: no scopeItems source at all.
        const result = evaluateReactiveExpression("scope(\"customer\")", {
            state: {},
            queries: {},
            params: {},
            storeNamePaths: {}
        });
        expect(result.error).toBeUndefined();
        expect(result.value).toBeUndefined();
    });

    it("scope(name) reads the per-instance named frames passed by the evaluator", () => {
        const result = evaluateReactiveExpression("scope(\"customer\").name", {
            state: {},
            queries: {},
            params: {},
            storeNamePaths: {},
            scopeItems: { customer: { name: "Ada" } }
        });
        expect(result.error).toBeUndefined();
        expect(result.value).toBe("Ada");
    });
});
