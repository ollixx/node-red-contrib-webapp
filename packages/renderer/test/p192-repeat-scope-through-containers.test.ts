import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    findComponentInSnapshot,
    type RenderedComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P192 (renderer) — the repeat item-scope must propagate THROUGH intermediate
 * child-bearing nodes (ui-container, ui-tabs/ui-tab, ui-accordion/-section), not
 * just the direct template children + nested repeat/component-instance.
 *
 * A `ui-text` bound to `item.<field>` / `index` that sits inside a container which
 * is itself inside a `ui-repeat` must resolve against the enclosing repeat's item —
 * per instance. Before P192 the container's children were rendered by the general
 * mount pass WITHOUT the item scope (and under the original, not the cloned id), so
 * `item` resolved to `undefined`.
 *
 * These snapshot tests are the unit acceptance; the browser proof is the
 * orchestrator's authoritative E2E (`tests/e2e/nodes/view/ui-repeat.spec.ts`).
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

const ROWS = [
    { id: "r1", name: "Ada", city: "London" },
    { id: "r2", name: "Linus", city: "Helsinki" },
    { id: "r3", name: "Grace", city: "New York" }
];

/** All `ui-text` nodes anywhere in the home route snapshot, by their resolved text. */
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

describe("P192 — item-scope through a ui-container inside a ui-repeat", () => {
    // ui-repeat → ui-container(horizontal) → 2× ui-text bound to item.* / index.
    function app(): AppModel {
        return {
            id: "app",
            name: "App",
            layouts: [
                { id: "main", slots: [{ name: "content" }] },
                { id: "row", slots: [{ name: "content" }] }
            ],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "rep",
                    kind: "repeat",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { items: { kind: "literal", value: ROWS } },
                    props: { keyField: "id" },
                    events: []
                },
                {
                    id: "box",
                    kind: "container",
                    mount: "container:rep/content",
                    order: 0,
                    bind: {},
                    props: { layoutId: "row" },
                    events: []
                },
                {
                    id: "nameText",
                    kind: "text",
                    mount: "container:box/content",
                    order: 0,
                    bind: { value: { kind: "item", path: "name" } },
                    props: {},
                    events: []
                },
                {
                    id: "cityText",
                    kind: "text",
                    mount: "container:box/content",
                    order: 1,
                    bind: { value: { kind: "item", path: "city" } },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("each container clone's children resolve item.* per row", () => {
        const rendered = createRendererApp(app(), { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual([
            "Ada", "London",
            "Linus", "Helsinki",
            "Grace", "New York"
        ]);
    });

    it("the cloned container + its children carry the per-instance id prefix", () => {
        const rendered = createRendererApp(app(), { integration: NO_INTEGRATION });
        const snapshot = rendered.render();
        // Keyed by `id` → itemKey = r1/r2/r3. Container clone id = <itemKey>#box;
        // its children = <itemKey>#nameText / <itemKey>#cityText.
        expect(findComponentInSnapshot(snapshot, "r1#box")?.kind).toBe("container");
        const nameClone = findComponentInSnapshot(snapshot, "r1#nameText");
        expect(nameClone?.kind).toBe("text");
        expect(nameClone && "text" in nameClone ? nameClone.text : undefined).toBe("Ada");
        // The ORIGINAL (un-cloned) ids must NOT appear in the snapshot.
        expect(findComponentInSnapshot(snapshot, "box")).toBeUndefined();
        expect(findComponentInSnapshot(snapshot, "nameText")).toBeUndefined();
    });
});

describe("P192 — item-scope through a ui-tab inside a ui-repeat", () => {
    // ui-repeat → ui-tabs → ui-tab → ui-text(item.name). The whole tabs host is
    // inside the repeat (one tabs instance per row), proving scope flows through a
    // tab's content subtree, not just the dynamic-tab-label path (P170).
    function app(): AppModel {
        return {
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
                    bind: { items: { kind: "literal", value: ROWS } },
                    props: { keyField: "id" },
                    events: []
                },
                {
                    id: "tabs",
                    kind: "tabs",
                    mount: "container:rep/content",
                    order: 0,
                    bind: {},
                    props: {},
                    events: []
                },
                {
                    id: "tab",
                    kind: "tab",
                    mount: "ui-tabs:tabs/content",
                    order: 0,
                    bind: { label: { kind: "literal", value: "Info" } },
                    props: {},
                    events: []
                },
                {
                    id: "body",
                    kind: "text",
                    mount: "ui-tab:tab/content",
                    order: 0,
                    bind: { value: { kind: "item", path: "name" } },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("each tabs clone's tab content resolves item.* per row", () => {
        const rendered = createRendererApp(app(), { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual(["Ada", "Linus", "Grace"]);
    });
});

describe("P192 — item-scope through a ui-accordion-section inside a ui-repeat", () => {
    // ui-repeat → ui-accordion → ui-accordion-section → ui-text(item.city).
    function app(): AppModel {
        return {
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
                    bind: { items: { kind: "literal", value: ROWS } },
                    props: { keyField: "id" },
                    events: []
                },
                {
                    id: "acc",
                    kind: "accordion",
                    mount: "container:rep/content",
                    order: 0,
                    bind: {},
                    props: {},
                    events: []
                },
                {
                    id: "sec",
                    kind: "accordion-section",
                    mount: "ui-accordion:acc/content",
                    order: 0,
                    bind: { label: { kind: "literal", value: "Detail" } },
                    props: {},
                    events: []
                },
                {
                    id: "body",
                    kind: "text",
                    mount: "ui-accordion-section:sec/content",
                    order: 0,
                    bind: { value: { kind: "item", path: "city" } },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("each accordion clone's section content resolves item.* per row", () => {
        const rendered = createRendererApp(app(), { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual(["London", "Helsinki", "New York"]);
    });
});

describe("P192 — deep + mixed nesting and no-regression", () => {
    // Container inside a tab inside a repeat — arbitrary nesting depth + mixture.
    it("a container nested inside a tab inside a repeat resolves item.* per row", () => {
        const model: AppModel = {
            id: "app",
            name: "App",
            layouts: [
                { id: "main", slots: [{ name: "content" }] },
                { id: "row", slots: [{ name: "content" }] }
            ],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "rep",
                    kind: "repeat",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { items: { kind: "literal", value: ROWS } },
                    props: { keyField: "id" },
                    events: []
                },
                {
                    id: "tabs",
                    kind: "tabs",
                    mount: "container:rep/content",
                    order: 0,
                    bind: {},
                    props: {},
                    events: []
                },
                {
                    id: "tab",
                    kind: "tab",
                    mount: "ui-tabs:tabs/content",
                    order: 0,
                    bind: { label: { kind: "literal", value: "T" } },
                    props: {},
                    events: []
                },
                {
                    id: "box",
                    kind: "container",
                    mount: "ui-tab:tab/content",
                    order: 0,
                    bind: {},
                    props: { layoutId: "row" },
                    events: []
                },
                {
                    id: "deep",
                    kind: "text",
                    mount: "container:box/content",
                    order: 0,
                    bind: { value: { kind: "item", path: "name" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual(["Ada", "Linus", "Grace"]);
    });

    // A nested ui-repeat inside a container inside the outer repeat still expands;
    // the inner item-frame wins (P164 semantics preserved).
    it("a nested repeat inside a container inside a repeat: inner frame wins", () => {
        const model: AppModel = {
            id: "app",
            name: "App",
            layouts: [
                { id: "main", slots: [{ name: "content" }] },
                { id: "row", slots: [{ name: "content" }] }
            ],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "outer",
                    kind: "repeat",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { items: { kind: "literal", value: [{ id: "a", kids: ["x", "y"] }, { id: "b", kids: ["z"] }] } },
                    props: { keyField: "id" },
                    events: []
                },
                {
                    id: "box",
                    kind: "container",
                    mount: "container:outer/content",
                    order: 0,
                    bind: {},
                    props: { layoutId: "row" },
                    events: []
                },
                {
                    id: "inner",
                    kind: "repeat",
                    mount: "container:box/content",
                    order: 0,
                    bind: { items: { kind: "item", path: "kids" } },
                    props: {},
                    events: []
                },
                {
                    id: "leaf",
                    kind: "text",
                    mount: "container:inner/content",
                    order: 0,
                    bind: { value: { kind: "item" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual(["x", "y", "z"]);
    });

    // No-regression: a ui-repeat with DIRECT children (no intermediate container)
    // renders exactly as before.
    it("a repeat with direct children (no container) is unchanged", () => {
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
                    bind: { items: { kind: "literal", value: ROWS } },
                    props: { keyField: "id" },
                    events: []
                },
                {
                    id: "row",
                    kind: "text",
                    mount: "container:rep/content",
                    order: 0,
                    bind: { value: { kind: "item", path: "name" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual(["Ada", "Linus", "Grace"]);
    });

    // Empty / 0-item case through a container: zero clones, no crash.
    it("an empty repeat with a container template renders nothing", () => {
        const model: AppModel = {
            id: "app",
            name: "App",
            layouts: [
                { id: "main", slots: [{ name: "content" }] },
                { id: "row", slots: [{ name: "content" }] }
            ],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "rep",
                    kind: "repeat",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { items: { kind: "literal", value: [] } },
                    props: { keyField: "id" },
                    events: []
                },
                {
                    id: "box",
                    kind: "container",
                    mount: "container:rep/content",
                    order: 0,
                    bind: {},
                    props: { layoutId: "row" },
                    events: []
                },
                {
                    id: "t",
                    kind: "text",
                    mount: "container:box/content",
                    order: 0,
                    bind: { value: { kind: "item", path: "name" } },
                    props: {},
                    events: []
                }
            ]
        };
        const rendered = createRendererApp(model, { integration: NO_INTEGRATION });
        expect(allTexts(rendered)).toEqual([]);
    });
});
