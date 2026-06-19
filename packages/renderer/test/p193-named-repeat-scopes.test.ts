import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    type RenderedComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P193 (renderer, ADR 0023) — named repeat scopes. An outer ui-repeat may NAME its
 * item scope (`props.itemName`). A descendant's scope-qualified `item`/`index`
 * binding (`{kind:"item", scope:"customer"}`) resolves against the matching named
 * frame regardless of inner repeats; an UNSCOPED `item`/`index` keeps resolving
 * against the innermost frame (P164 semantics).
 *
 * Snapshot tests are the unit acceptance; the browser proof is the orchestrator's
 * E2E (`tests/e2e/nodes/view/ui-repeat.spec.ts`).
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

/** All `ui-text` nodes anywhere in the home route snapshot, by resolved text. */
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

// Two customers, each with two orders. Nested repeat: outer = customer, inner =
// order. A deep ui-text reaches BOTH levels by name.
const CUSTOMERS = [
    { id: "c1", name: "Ada", orders: [{ total: 10 }, { total: 20 }] },
    { id: "c2", name: "Linus", orders: [{ total: 30 }, { total: 40 }] }
];

describe("P193 — scoped item resolves the OUTER row while unscoped resolves the inner", () => {
    // outer ui-repeat(itemName=customer) → inner ui-repeat(itemName=order) →
    // ui-text bound to `item:customer.name` (outer) AND a sibling to `item:order.total`
    // (inner) AND a sibling to the UNSCOPED `item.total` (innermost == order).
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
                    // inner items = the customer's orders (scoped item resolves outer).
                    bind: { items: { kind: "item", scope: "customer", path: "orders" } },
                    props: { itemName: "order" },
                    events: []
                },
                {
                    id: "customerName",
                    kind: "text",
                    mount: "container:inner/content",
                    order: 0,
                    // scoped → OUTER customer, past the inner order frame.
                    bind: { value: { kind: "item", scope: "customer", path: "name" } },
                    props: {},
                    events: []
                },
                {
                    id: "orderTotal",
                    kind: "text",
                    mount: "container:inner/content",
                    order: 1,
                    // scoped → INNER order by name.
                    bind: { value: { kind: "item", scope: "order", path: "total" } },
                    props: {},
                    events: []
                },
                {
                    id: "bareTotal",
                    kind: "text",
                    mount: "container:inner/content",
                    order: 2,
                    // UNSCOPED → innermost (== order) — backward-compatible.
                    bind: { value: { kind: "item", path: "total" } },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("scoped customer.name reaches the OUTER row; order.total and bare item.total reach the inner", () => {
        const rendered = createRendererApp(app(), { integration: NO_INTEGRATION });
        // Order per inner clone: customerName, orderTotal, bareTotal.
        expect(allTexts(rendered)).toEqual([
            // Ada's two orders
            "Ada", "10", "10",
            "Ada", "20", "20",
            // Linus' two orders
            "Linus", "30", "30",
            "Linus", "40", "40"
        ]);
    });

    it("a scoped index reaches the OUTER position while the bare index is the inner", () => {
        const model = app();
        // Re-point the three texts to index forms.
        const texts = model.components.filter((c) => c.kind === "text");
        texts[0].bind = { value: { kind: "index", scope: "customer" } };
        texts[1].bind = { value: { kind: "index", scope: "order" } };
        texts[2].bind = { value: { kind: "index" } };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual([
            // customerIndex, orderIndex(scoped), orderIndex(bare)
            "0", "0", "0",
            "0", "1", "1",
            "1", "0", "0",
            "1", "1", "1"
        ]);
    });
});

describe("P193 — backward compatibility & no-match", () => {
    // A scoped binding whose alias matches NO enclosing repeat resolves to
    // undefined (→ fallback), never a throw.
    it("an unmatched scope resolves to the fallback (no throw)", () => {
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
                    bind: { value: { kind: "item", scope: "nope", path: "name", fallback: "—" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual(["—"]);
    });

    // An UNNAMED repeat carries no alias; a same-name scope inside two repeats
    // resolves the NEAREST one (inner shadows outer).
    it("an inner same-named repeat shadows an outer one (nearest frame wins)", () => {
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
                    bind: { value: { kind: "item", scope: "row", path: "v" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        // The inner `row` (kids element) shadows the outer `row` (the object).
        expect(allTexts(rendered)).toEqual(["inner"]);
    });
});
