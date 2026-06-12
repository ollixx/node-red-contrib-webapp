import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    findComponentInSnapshot,
    type RenderedComponent,
    type RenderedTabsComponent,
    type RenderedAccordionComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P170 (ADR 0017 × 0018, capstone) — DYNAMIC tabs/sections via ui-repeat.
 *
 * The dynamic case is NOT a bespoke mechanism: a `ui-repeat` whose template is a
 * single `ui-tab` (`label = item.<field>`), mounted into a `ui-tabs`, renders one
 * keyed tab per data row. Same for `ui-accordion` + `ui-accordion-section`. These
 * snapshot tests prove the composition end-to-end at the renderer; the runtime
 * test (`p170-dynamic-tabs-sections.test.ts` under runtime) proves the rendered
 * HTML, and the browser proof is the orchestrator's authoritative E2E.
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

const ROWS_INTEGRATION: RuntimeIntegrationModel = {
    stores: [{ id: "rowsStore", name: "rows", statePath: "rows" }],
    queries: [],
    actions: [],
    navigations: []
};

/**
 * A `ui-tabs` whose ONLY child is a `ui-repeat` (mounted into the tabs) whose
 * template is a single `ui-tab` (mounted into the repeat). The tab's `label`
 * binds to `item.<field>`; its content is a single `ui-text` bound to another
 * `item.<field>`. `keyField` drives the keyed clone id.
 */
function dynamicTabsApp(
    itemsBinding: BindingDefinition,
    keyField: string,
    activeTab?: BindingDefinition
): AppModel {
    return {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "tabs",
                kind: "tabs",
                mount: "route:/home/content",
                order: 0,
                bind: activeTab ? { value: activeTab } : {},
                props: {},
                events: []
            },
            {
                id: "rep",
                kind: "repeat",
                mount: "ui-tabs:tabs/content",
                order: 0,
                bind: { items: itemsBinding },
                props: { keyField },
                events: []
            },
            {
                id: "tab",
                kind: "tab",
                mount: "container:rep/content",
                order: 0,
                bind: { label: { kind: "item", path: "name" } },
                props: {},
                events: []
            },
            {
                id: "body",
                kind: "text",
                mount: "ui-tab:tab/content",
                order: 0,
                bind: { value: { kind: "item", path: "bio" } },
                props: {},
                events: []
            }
        ]
    };
}

/**
 * Same shape for ui-accordion + ui-accordion-section.
 */
function dynamicAccordionApp(
    itemsBinding: BindingDefinition,
    keyField: string,
    openSection?: BindingDefinition
): AppModel {
    return {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "acc",
                kind: "accordion",
                mount: "route:/home/content",
                order: 0,
                bind: openSection ? { value: openSection } : {},
                props: {},
                events: []
            },
            {
                id: "rep",
                kind: "repeat",
                mount: "ui-accordion:acc/content",
                order: 0,
                bind: { items: itemsBinding },
                props: { keyField },
                events: []
            },
            {
                id: "sec",
                kind: "accordion-section",
                mount: "container:rep/content",
                order: 0,
                bind: { label: { kind: "item", path: "name" } },
                props: {},
                events: []
            },
            {
                id: "body",
                kind: "text",
                mount: "ui-accordion-section:sec/content",
                order: 0,
                bind: { value: { kind: "item", path: "bio" } },
                props: {},
                events: []
            }
        ]
    };
}

function tabsOf(app: ReturnType<typeof createRendererApp>): RenderedTabsComponent {
    const found = findComponentInSnapshot(app.render(), "tabs");
    if (!found || found.kind !== "tabs") {
        throw new Error("tabs component not found");
    }
    return found;
}

function accordionOf(app: ReturnType<typeof createRendererApp>): RenderedAccordionComponent {
    const found = findComponentInSnapshot(app.render(), "acc");
    if (!found || found.kind !== "accordion") {
        throw new Error("accordion component not found");
    }
    return found;
}

interface SectionMeta {
    id: string;
    label: string;
    active?: boolean;
    open?: boolean;
}

function tabsMeta(tabs: RenderedTabsComponent): SectionMeta[] {
    return (tabs.props.tabs as SectionMeta[]);
}

function sectionsMeta(acc: RenderedAccordionComponent): SectionMeta[] {
    return (acc.props.sections as SectionMeta[]);
}

function regionTexts(regions: { name: string; components: RenderedComponent[] }[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const region of regions) {
        out[region.name] = region.components
            .filter((c): c is RenderedTextComponent => c.kind === "text")
            .map((c) => c.text);
    }
    return out;
}

describe("P170 — dynamic ui-tabs: a ui-repeat of ui-tab renders N keyed tabs", () => {
    it("a 3-row array yields 3 tabs, one per row, label = item.name", () => {
        const app = createRendererApp(
            dynamicTabsApp(
                {
                    kind: "literal",
                    value: [
                        { id: "a", name: "Ada", bio: "Analyst" },
                        { id: "l", name: "Linus", bio: "Kernel" },
                        { id: "g", name: "Grace", bio: "Compiler" }
                    ]
                },
                "id"
            ),
            { integration: NO_INTEGRATION }
        );

        const tabs = tabsOf(app);
        const meta = tabsMeta(tabs);
        expect(meta.map((m) => m.id)).toEqual(["a#tab", "l#tab", "g#tab"]);
        expect(meta.map((m) => m.label)).toEqual(["Ada", "Linus", "Grace"]);

        // each tab's content resolves against ITS item scope.
        const texts = regionTexts(tabs.regions);
        expect(texts["a#tab"]).toEqual(["Analyst"]);
        expect(texts["l#tab"]).toEqual(["Kernel"]);
        expect(texts["g#tab"]).toEqual(["Compiler"]);
    });

    it("default active = first dynamic tab by order when no activeTab is bound", () => {
        const app = createRendererApp(
            dynamicTabsApp(
                { kind: "literal", value: [{ id: "a", name: "Ada" }, { id: "l", name: "Linus" }] },
                "id"
            ),
            { integration: NO_INTEGRATION }
        );
        const meta = tabsMeta(tabsOf(app));
        expect(meta.find((m) => m.active)?.id).toBe("a#tab");
    });

    it("an empty array yields zero tabs (no crash)", () => {
        const app = createRendererApp(
            dynamicTabsApp({ kind: "literal", value: [] }, "id"),
            { integration: NO_INTEGRATION }
        );
        expect(tabsMeta(tabsOf(app))).toHaveLength(0);
    });
});

describe("P170 — dynamic ui-accordion: a ui-repeat of ui-accordion-section renders N keyed sections", () => {
    it("a 2-row array yields 2 sections, label = item.name, content per item scope", () => {
        const app = createRendererApp(
            dynamicAccordionApp(
                { kind: "literal", value: [{ id: "a", name: "Ada", bio: "Analyst" }, { id: "l", name: "Linus", bio: "Kernel" }] },
                "id"
            ),
            { integration: NO_INTEGRATION }
        );

        const acc = accordionOf(app);
        const meta = sectionsMeta(acc);
        expect(meta.map((m) => m.id)).toEqual(["a#sec", "l#sec"]);
        expect(meta.map((m) => m.label)).toEqual(["Ada", "Linus"]);

        const texts = regionTexts(acc.regions);
        expect(texts["a#sec"]).toEqual(["Analyst"]);
        expect(texts["l#sec"]).toEqual(["Kernel"]);
    });

    it("default open = first dynamic section by order", () => {
        const app = createRendererApp(
            dynamicAccordionApp(
                { kind: "literal", value: [{ id: "a", name: "Ada" }, { id: "l", name: "Linus" }] },
                "id"
            ),
            { integration: NO_INTEGRATION }
        );
        const meta = sectionsMeta(accordionOf(app));
        expect(meta.find((m) => m.open)?.id).toBe("a#sec");
    });
});

describe("P170 — keying / stability: array change reshapes the tab set, keyed; activeTab survives", () => {
    it("reorder keeps each tab's keyed id and content; only position changes", () => {
        const app = createRendererApp(
            dynamicTabsApp({ kind: "store", path: "rowsStore" }, "id"),
            {
                integration: ROWS_INTEGRATION,
                state: { rows: [{ id: "a", name: "Ada", bio: "Analyst" }, { id: "b", name: "Linus", bio: "Kernel" }] }
            }
        );

        expect(tabsMeta(tabsOf(app)).map((m) => m.id)).toEqual(["a#tab", "b#tab"]);

        app.replaceState({ rows: [{ id: "b", name: "Linus", bio: "Kernel" }, { id: "a", name: "Ada", bio: "Analyst" }] });

        const meta = tabsMeta(tabsOf(app));
        expect(meta.map((m) => m.id)).toEqual(["b#tab", "a#tab"]);
        // unchanged instances keep their keyed id+content across the reorder.
        const texts = regionTexts(tabsOf(app).regions);
        expect(texts["a#tab"]).toEqual(["Analyst"]);
        expect(texts["b#tab"]).toEqual(["Kernel"]);
    });

    it("insert adds one tab, keeps existing keyed ids", () => {
        const app = createRendererApp(
            dynamicTabsApp({ kind: "store", path: "rowsStore" }, "id"),
            {
                integration: ROWS_INTEGRATION,
                state: { rows: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }] }
            }
        );

        app.replaceState({ rows: [{ id: "a", name: "Ada" }, { id: "c", name: "Grace" }, { id: "b", name: "Linus" }] });
        expect(tabsMeta(tabsOf(app)).map((m) => m.id)).toEqual(["a#tab", "c#tab", "b#tab"]);
    });

    it("delete removes only the deleted tab; survivors keep their ids", () => {
        const app = createRendererApp(
            dynamicTabsApp({ kind: "store", path: "rowsStore" }, "id"),
            {
                integration: ROWS_INTEGRATION,
                state: { rows: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }, { id: "c", name: "Grace" }] }
            }
        );

        app.replaceState({ rows: [{ id: "a", name: "Ada" }, { id: "c", name: "Grace" }] });
        expect(tabsMeta(tabsOf(app)).map((m) => m.id)).toEqual(["a#tab", "c#tab"]);
    });

    it("activeTab pointing at a keyed clone id stays active while that row exists, falls back when it is removed", () => {
        const app = createRendererApp(
            dynamicTabsApp({ kind: "store", path: "rowsStore" }, "id", { kind: "literal", value: "b#tab" }),
            {
                integration: ROWS_INTEGRATION,
                state: { rows: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }, { id: "c", name: "Grace" }] }
            }
        );

        // 'b#tab' exists → it is the active tab, stable across an unrelated reorder.
        expect(tabsMeta(tabsOf(app)).find((m) => m.active)?.id).toBe("b#tab");
        app.replaceState({ rows: [{ id: "c", name: "Grace" }, { id: "b", name: "Linus" }, { id: "a", name: "Ada" }] });
        expect(tabsMeta(tabsOf(app)).find((m) => m.active)?.id).toBe("b#tab");

        // remove row b → activeTab no longer matches any child → falls back to first.
        app.replaceState({ rows: [{ id: "c", name: "Grace" }, { id: "a", name: "Ada" }] });
        expect(tabsMeta(tabsOf(app)).find((m) => m.active)?.id).toBe("c#tab");
    });

    it("accordion: reorder + open-state stability mirrors tabs", () => {
        const app = createRendererApp(
            dynamicAccordionApp({ kind: "store", path: "rowsStore" }, "id", { kind: "literal", value: "b#sec" }),
            {
                integration: ROWS_INTEGRATION,
                state: { rows: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }] }
            }
        );

        expect(sectionsMeta(accordionOf(app)).find((m) => m.open)?.id).toBe("b#sec");
        app.replaceState({ rows: [{ id: "b", name: "Linus" }, { id: "a", name: "Ada" }] });
        const meta = sectionsMeta(accordionOf(app));
        expect(meta.map((m) => m.id)).toEqual(["b#sec", "a#sec"]);
        expect(meta.find((m) => m.open)?.id).toBe("b#sec");
    });
});

describe("P170 — composition, not a new mechanism: static + dynamic mix in one container", () => {
    it("a static ui-tab and a dynamic ui-repeat-of-ui-tab coexist under one ui-tabs", () => {
        const model: AppModel = {
            id: "app",
            name: "App",
            layouts: [{ id: "main", slots: [{ name: "content" }] }],
            routes: [{ id: "home", path: "/home", layoutId: "main" }],
            dialogs: [],
            components: [
                { id: "tabs", kind: "tabs", mount: "route:/home/content", order: 0, bind: {}, props: {}, events: [] },
                // static tab first (order 0)
                { id: "fixed", kind: "tab", mount: "ui-tabs:tabs/content", order: 0, bind: { label: { kind: "literal", value: "Home" } }, props: {}, events: [] },
                // dynamic repeat after (order 1)
                { id: "rep", kind: "repeat", mount: "ui-tabs:tabs/content", order: 1, bind: { items: { kind: "literal", value: [{ id: "a", name: "Ada" }] } }, props: { keyField: "id" }, events: [] },
                { id: "tab", kind: "tab", mount: "container:rep/content", order: 0, bind: { label: { kind: "item", path: "name" } }, props: {}, events: [] }
            ]
        };
        const app = createRendererApp(model, { integration: NO_INTEGRATION });
        const meta = tabsMeta(tabsOf(app));
        expect(meta.map((m) => m.id)).toEqual(["fixed", "a#tab"]);
        expect(meta.map((m) => m.label)).toEqual(["Home", "Ada"]);
    });
});
