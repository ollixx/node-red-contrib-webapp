import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    findComponentInSnapshot,
    type RenderedComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P164 (ADR 0017) — renderer half of `ui-repeat`: template clone, render-time
 * item scope (`item` / `item.<path>` / `index`), and keyed per-instance ids.
 *
 * These snapshot tests ARE the acceptance for the phase (`verify: unit`); the
 * browser proof of the full flow is P165.
 */

beforeEach(() => {
    __resetReactiveCache();
});

/**
 * A minimal app with ONE repeat in the route's content slot and ONE `ui-text`
 * child in the repeat's default slot (mount `container:<repeatId>/content`). The
 * child's `value` binding is supplied by the caller (typically an `item.*` /
 * `index` binding). `keyField` is optional.
 */
function appWithRepeat(
    itemsBinding: BindingDefinition,
    childValue: BindingDefinition,
    keyField?: string
): AppModel {
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
                bind: { items: itemsBinding },
                props: keyField ? { keyField } : {},
                events: []
            },
            {
                id: "row",
                kind: "text",
                mount: "container:rep/content",
                order: 0,
                bind: { value: childValue },
                props: {},
                events: []
            }
        ]
    };
}

/** The flat list of components rendered into the home route's content region. */
function contentComponents(app: ReturnType<typeof createRendererApp>): RenderedComponent[] {
    const region = app.render().regions.find((candidate) => candidate.name === "content");
    return region ? region.components : [];
}

function texts(app: ReturnType<typeof createRendererApp>): string[] {
    return contentComponents(app)
        .filter((component): component is RenderedTextComponent => component.kind === "text")
        .map((component) => component.text);
}

function ids(app: ReturnType<typeof createRendererApp>): string[] {
    return contentComponents(app).map((component) => component.id);
}

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

describe("P164 — template clone count (array → n×)", () => {
    it("a 3-element array clones the default-slot template 3×", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: [{ name: "Ada" }, { name: "Linus" }, { name: "Grace" }] },
                { kind: "item", path: "name" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(texts(app)).toEqual(["Ada", "Linus", "Grace"]);
    });

    it("an empty array clones zero times", () => {
        const app = createRendererApp(
            appWithRepeat({ kind: "literal", value: [] }, { kind: "item", path: "name" }),
            { integration: NO_INTEGRATION }
        );

        expect(contentComponents(app)).toHaveLength(0);
    });

    it("a non-array, non-object source (scalar) clones zero times — no crash", () => {
        const app = createRendererApp(
            appWithRepeat({ kind: "literal", value: 42 }, { kind: "item" }),
            { integration: NO_INTEGRATION }
        );

        expect(contentComponents(app)).toHaveLength(0);
    });
});

describe("P164 — object source iterates as {key, value} entries", () => {
    it("an object source yields one instance per entry with item.key / item.value", () => {
        const model = appWithRepeat(
            { kind: "literal", value: { de: "Deutsch", en: "English" } },
            { kind: "item", path: "key" }
        );
        const app = createRendererApp(model, { integration: NO_INTEGRATION });

        expect(texts(app)).toEqual(["de", "en"]);
    });

    it("item.value reaches into the entry value", () => {
        const model = appWithRepeat(
            { kind: "literal", value: { de: "Deutsch", en: "English" } },
            { kind: "item", path: "value" }
        );
        const app = createRendererApp(model, { integration: NO_INTEGRATION });

        expect(texts(app)).toEqual(["Deutsch", "English"]);
    });
});

describe("P164 — per-instance scope resolution (different instances, different values)", () => {
    it("item.<path> resolves against the current element per instance", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: [{ city: "Berlin" }, { city: "Oslo" }] },
                { kind: "item", path: "city" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(texts(app)).toEqual(["Berlin", "Oslo"]);
    });

    it("a multi-level item.<path> (address.city) resolves per instance", () => {
        const app = createRendererApp(
            appWithRepeat(
                {
                    kind: "literal",
                    value: [{ address: { city: "Berlin" } }, { address: { city: "Oslo" } }]
                },
                { kind: "item", path: "address.city" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(texts(app)).toEqual(["Berlin", "Oslo"]);
    });

    it("index resolves to the zero-based position per instance", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: [{ name: "Ada" }, { name: "Linus" }, { name: "Grace" }] },
                { kind: "index" }
            ),
            { integration: NO_INTEGRATION }
        );

        // index 0/1/2 normalised to display strings by the text node.
        expect(texts(app)).toEqual(["0", "1", "2"]);
    });

    it("bare item (no path) resolves to the whole element (object → '?' display marker, no crash)", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: [{ name: "Ada" }, { name: "Linus" }] },
                { kind: "item" }
            ),
            { integration: NO_INTEGRATION }
        );

        // The whole element is an object — not a displayable scalar → "?" (P104),
        // but TWO instances are produced and nothing throws.
        expect(texts(app)).toEqual(["?", "?"]);
    });
});

describe("P164 — item / index OUTSIDE a repeat → undefined, no crash", () => {
    function appWithLooseText(valueBinding: BindingDefinition): AppModel {
        return {
            id: "app",
            name: "App",
            layouts: [{ id: "main", slots: [{ name: "content" }] }],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                {
                    id: "loose",
                    kind: "text",
                    mount: "route:/home/content",
                    order: 0,
                    bind: { value: valueBinding },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("an `item` binding with no enclosing repeat resolves to undefined → '?' (no throw)", () => {
        const app = createRendererApp(appWithLooseText({ kind: "item", path: "name" }), {
            integration: NO_INTEGRATION
        });

        const text = findComponentInSnapshot(app.render(), "loose");
        expect(text && "text" in text ? text.text : undefined).toBe("?");
    });

    it("an `index` binding with no enclosing repeat resolves to undefined → '?' (no throw)", () => {
        const app = createRendererApp(appWithLooseText({ kind: "index" }), {
            integration: NO_INTEGRATION
        });

        const text = findComponentInSnapshot(app.render(), "loose");
        expect(text && "text" in text ? text.text : undefined).toBe("?");
    });

    it("an `item` binding with a fallback uses the fallback outside a repeat", () => {
        const app = createRendererApp(
            appWithLooseText({ kind: "item", path: "name", fallback: "n/a" }),
            { integration: NO_INTEGRATION }
        );

        const text = findComponentInSnapshot(app.render(), "loose");
        expect(text && "text" in text ? text.text : undefined).toBe("n/a");
    });
});

describe("P164 — per-instance keyed ids (keyField × childId, else index)", () => {
    it("keyField composes a stable per-instance id `<key>#<childId>`", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: [{ name: "Ada" }, { name: "Linus" }] },
                { kind: "item", path: "name" },
                "name"
            ),
            { integration: NO_INTEGRATION }
        );

        expect(ids(app)).toEqual(["Ada#row", "Linus#row"]);
    });

    it("without keyField the per-instance id falls back to the array index", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: [{ name: "Ada" }, { name: "Linus" }] },
                { kind: "item", path: "name" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(ids(app)).toEqual(["0#row", "1#row"]);
    });

    it("keyed ids are STABLE across a reorder — the unchanged instance keeps its id+value", () => {
        // Reorder via a reactive store source so a real re-render happens.
        const model = appWithRepeat(
            { kind: "store", path: "rowsStore" },
            { kind: "item", path: "name" },
            "id"
        );
        const integration: RuntimeIntegrationModel = {
            stores: [{ id: "rowsStore", name: "rows", statePath: "rows" }],
            queries: [],
            actions: [],
            navigations: []
        };
        const app = createRendererApp(model, {
            integration,
            state: { rows: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }] }
        });

        expect(ids(app)).toEqual(["a#row", "b#row"]);
        expect(texts(app)).toEqual(["Ada", "Linus"]);

        // Reorder: b before a. Each instance keeps its KEY-derived id; only position
        // changes, so a keyed morph can preserve the unchanged DOM.
        app.replaceState({ rows: [{ id: "b", name: "Linus" }, { id: "a", name: "Ada" }] });

        expect(ids(app)).toEqual(["b#row", "a#row"]);
        expect(texts(app)).toEqual(["Linus", "Ada"]);
    });

    it("insert keeps existing instance ids and adds one for the new element", () => {
        const model = appWithRepeat({ kind: "store", path: "rowsStore" }, { kind: "item", path: "name" }, "id");
        const integration: RuntimeIntegrationModel = {
            stores: [{ id: "rowsStore", name: "rows", statePath: "rows" }],
            queries: [],
            actions: [],
            navigations: []
        };
        const app = createRendererApp(model, {
            integration,
            state: { rows: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }] }
        });

        app.replaceState({
            rows: [{ id: "a", name: "Ada" }, { id: "c", name: "Grace" }, { id: "b", name: "Linus" }]
        });

        expect(ids(app)).toEqual(["a#row", "c#row", "b#row"]);
        expect(texts(app)).toEqual(["Ada", "Grace", "Linus"]);
    });

    it("delete removes only the deleted instance's id; survivors keep theirs", () => {
        const model = appWithRepeat({ kind: "store", path: "rowsStore" }, { kind: "item", path: "name" }, "id");
        const integration: RuntimeIntegrationModel = {
            stores: [{ id: "rowsStore", name: "rows", statePath: "rows" }],
            queries: [],
            actions: [],
            navigations: []
        };
        const app = createRendererApp(model, {
            integration,
            state: { rows: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }, { id: "c", name: "Grace" }] }
        });

        app.replaceState({ rows: [{ id: "a", name: "Ada" }, { id: "c", name: "Grace" }] });

        expect(ids(app)).toEqual(["a#row", "c#row"]);
        expect(texts(app)).toEqual(["Ada", "Grace"]);
    });
});

describe("P164 — reactive items → fresh snapshot with correct instance count", () => {
    it("a store-array change re-renders with the new element count", () => {
        const model = appWithRepeat({ kind: "store", path: "rowsStore" }, { kind: "item", path: "name" });
        const integration: RuntimeIntegrationModel = {
            stores: [{ id: "rowsStore", name: "rows", statePath: "rows" }],
            queries: [],
            actions: [],
            navigations: []
        };
        const app = createRendererApp(model, {
            integration,
            state: { rows: [{ name: "Ada" }] }
        });

        expect(texts(app)).toEqual(["Ada"]);

        app.replaceState({ rows: [{ name: "Ada" }, { name: "Linus" }, { name: "Grace" }] });
        expect(texts(app)).toEqual(["Ada", "Linus", "Grace"]);

        app.replaceState({ rows: [] });
        expect(contentComponents(app)).toHaveLength(0);
    });

    it("a query-array sets items via replaceQueries and re-renders the instance count", () => {
        const model = appWithRepeat({ kind: "query", path: "people" }, { kind: "item", path: "name" });
        const integration: RuntimeIntegrationModel = {
            stores: [],
            queries: [{ id: "peopleQuery", queryPath: "people", refreshAction: "loadPeople" }],
            actions: [],
            navigations: []
        };
        const app = createRendererApp(model, {
            integration,
            queries: { people: [{ name: "Ada" }, { name: "Linus" }] }
        });

        expect(texts(app)).toEqual(["Ada", "Linus"]);

        app.replaceQueries({ people: [{ name: "Grace" }] });
        expect(texts(app)).toEqual(["Grace"]);
    });
});

describe("P164 — nested repeats (scope is a stack, innermost wins; at minimum no crash)", () => {
    function nestedRepeatApp(): AppModel {
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
                    bind: { items: { kind: "literal", value: [
                        { group: "A", members: [{ name: "Ada" }, { name: "Alan" }] },
                        { group: "B", members: [{ name: "Bob" }] }
                    ] } },
                    props: { keyField: "group" },
                    events: []
                },
                // inner repeat is a child of the outer template; its items come from
                // the OUTER item (item.members).
                {
                    id: "inner",
                    kind: "repeat",
                    mount: "container:outer/content",
                    order: 0,
                    bind: { items: { kind: "item", path: "members" } },
                    props: { keyField: "name" },
                    events: []
                },
                // the innermost child reads item.name → the INNER frame (innermost wins).
                {
                    id: "leaf",
                    kind: "text",
                    mount: "container:inner/content",
                    order: 0,
                    bind: { value: { kind: "item", path: "name" } },
                    props: {},
                    events: []
                }
            ]
        };
    }

    it("inner item wins for `item` — innermost frame resolves the leaf value", () => {
        const app = createRendererApp(nestedRepeatApp(), { integration: NO_INTEGRATION });

        // outer A → [Ada, Alan]; outer B → [Bob] — flattened in order.
        expect(texts(app)).toEqual(["Ada", "Alan", "Bob"]);
    });

    it("nested instance ids compose both levels' keys without collision", () => {
        const app = createRendererApp(nestedRepeatApp(), { integration: NO_INTEGRATION });

        // outer-key # inner-key # leafId, no collisions across groups.
        expect(ids(app)).toEqual(["A#Ada#leaf", "A#Alan#leaf", "B#Bob#leaf"]);
    });
});

describe("P184 — whole-`item` + `index` over a PRIMITIVE (string) array", () => {
    // The bug this phase fixes: binding to a string ELEMENT in its entirety
    // (whole `item`, no path) and to its `index`. Both are serialised with an
    // EMPTY path by older editor builds (path:''), so the renderer must resolve
    // them end-to-end exactly as the path-free forms.

    it("whole-`item` (path:'') renders each string element verbatim", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: ["alpha", "beta", "gamma"] },
                { kind: "item", path: "" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(texts(app)).toEqual(["alpha", "beta", "gamma"]);
    });

    it("path-free whole-`item` ({kind:'item'}) renders each string element verbatim", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: ["alpha", "beta", "gamma"] },
                { kind: "item" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(texts(app)).toEqual(["alpha", "beta", "gamma"]);
    });

    it("`index` (path:'') renders the zero-based position of each string element", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: ["alpha", "beta", "gamma"] },
                { kind: "index", path: "" }
            ),
            { integration: NO_INTEGRATION }
        );

        // index 0/1/2 normalised to display strings by the text node.
        expect(texts(app)).toEqual(["0", "1", "2"]);
    });
});
