import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    findComponentInSnapshot,
    type RenderedComponent,
    type RenderedTabsComponent
} from "../src";

/**
 * Regression guard (fix/ui-tabs-event-id): a PLAIN `ui-tabs` (two static
 * `ui-tab` children, NO `ui-repeat` in between) must derive one tab per child
 * whose `id` (and the matching `region.name`) equals the ACTUAL child id —
 * "overview" / "details", in order. The serializer turns each tab id into the
 * `<sl-tab panel="…">` value, and a `change` event reports the activated tab's
 * id as `params.value`. If the second tab's id collapses to the first child's
 * id, activating "details" wrongly reports "overview" (the E2E E01 symptom).
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

/**
 * A plain `ui-tabs` with two static `ui-tab` children (overview, details), each
 * carrying a single `ui-text` content child. No repeat anywhere.
 */
function plainTabsApp(): AppModel {
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
                bind: {},
                props: {},
                events: ["change"]
            },
            {
                id: "overview",
                kind: "tab",
                mount: "ui-tabs:tabs/content",
                order: 0,
                bind: { label: { kind: "literal", value: "Overview" } },
                props: {},
                events: []
            },
            {
                id: "details",
                kind: "tab",
                mount: "ui-tabs:tabs/content",
                order: 1,
                bind: { label: { kind: "literal", value: "Details" } },
                props: {},
                events: []
            },
            {
                id: "overviewText",
                kind: "text",
                mount: "ui-tab:overview/content",
                order: 0,
                bind: { value: { kind: "literal", value: "Overview body" } },
                props: {},
                events: []
            },
            {
                id: "detailsText",
                kind: "text",
                mount: "ui-tab:details/content",
                order: 0,
                bind: { value: { kind: "literal", value: "Details body" } },
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

interface TabMeta {
    id: string;
    label: string;
    active?: boolean;
}

/**
 * A `ui-tabs` whose ONLY child is a `ui-repeat` (mounted into the tabs) whose
 * template is a single `ui-tab`. Each item yields one keyed tab. Mirrors P170/P192:
 * the keyed clone id (`<itemKey>#tab`) is the tab id AND the region name — so a
 * `change` event reports the activated keyed instance, distinct per row.
 */
function repeatTabsApp(items: { id: string; name: string }[]): AppModel {
    const itemsBinding: BindingDefinition = { kind: "literal", value: items };
    return {
        id: "app",
        name: "App",
        layouts: [
            { id: "main", slots: [{ name: "content" }] },
            { id: "vertical", slots: [{ name: "content" }] }
        ],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            { id: "tabs", kind: "tabs", mount: "route:/home/content", order: 0, bind: {}, props: {}, events: ["change"] },
            {
                id: "rep", kind: "repeat", mount: "ui-tabs:tabs/content", order: 0,
                bind: { items: itemsBinding }, props: { keyField: "id" }, events: []
            },
            {
                id: "tab", kind: "tab", mount: "container:rep/content", order: 0,
                bind: { label: { kind: "item", path: "name" } }, props: {}, events: []
            }
        ]
    };
}

describe("plain ui-tabs (no repeat) — per-tab id/value wiring", () => {
    it("each static tab keeps its own child id; first vs second are distinct", () => {
        const tabs = tabsOf(createRendererApp(plainTabsApp(), { integration: NO_INTEGRATION }));
        const meta = tabs.props.tabs as TabMeta[];

        // The two tabs map to their actual child ids, in order — NOT both to the
        // first child id (the regression).
        expect(meta.map((m) => m.id)).toEqual(["overview", "details"]);

        // The region names (which the serializer emits as sl-tab-panel names) match
        // the tab ids one-to-one.
        expect(tabs.regions.map((r) => r.name)).toEqual(["overview", "details"]);

        // No activeTab bound → first child by order is the active/default value.
        expect(tabs.value).toBe("overview");
        expect(meta.find((m) => m.active)?.id).toBe("overview");
    });

    it("the SECOND tab's content lives under the SECOND tab id (not the first)", () => {
        const tabs = tabsOf(createRendererApp(plainTabsApp(), { integration: NO_INTEGRATION }));

        const detailsRegion = tabs.regions.find((r) => r.name === "details");
        expect(detailsRegion).toBeDefined();
        const text = (detailsRegion as { components: RenderedComponent[] }).components
            .find((c): c is RenderedComponent & { text: string } => c.kind === "text");
        expect(text?.text).toBe("Details body");
    });
});

describe("in-repeat ui-tabs — per-instance keyed tab id/value wiring (P170/P192)", () => {
    it("each item yields a distinct keyed tab id; second instance is not the first", () => {
        const tabs = tabsOf(createRendererApp(
            repeatTabsApp([{ id: "a", name: "Ada" }, { id: "l", name: "Linus" }]),
            { integration: NO_INTEGRATION }
        ));
        const meta = tabs.props.tabs as TabMeta[];

        // The two keyed clones keep distinct ids — the second tab does NOT collapse
        // to the first. (This is the in-repeat side of the change-event id wiring.)
        expect(meta.map((m) => m.id)).toEqual(["a#tab", "l#tab"]);
        expect(tabs.regions.map((r) => r.name)).toEqual(["a#tab", "l#tab"]);

        // Default active = first keyed clone; component.value (the change-event id
        // source) is that exact keyed id, not undefined or the template id.
        expect(tabs.value).toBe("a#tab");
        expect(meta.find((m) => m.active)?.id).toBe("a#tab");
    });
});
