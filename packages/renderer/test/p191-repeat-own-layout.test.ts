import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    type RenderedComponent,
    type RenderedContainerComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P191 — ui-repeat is a true CONTAINER: its `content` slot (REPEAT_SLOT) carries
 * its OWN layout preset (like ui-container's `layoutId`). Each per-item clone-set is
 * placed into that layout's regions — the cloned children render UNDER the chosen
 * layout's region(s), per item, with the item scope intact.
 *
 * The unit acceptance is the snapshot shape (one `container`-kind component per item,
 * carrying `layoutId` + `regions`); the browser proof is the orchestrator's
 * authoritative E2E (`tests/e2e/nodes/view/ui-repeat.spec.ts`).
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

/**
 * A minimal app: ONE repeat (with its OWN content-slot `layoutId`) in the route's
 * content slot, and ONE `ui-text` child in the repeat's `content` slot bound to the
 * given value (typically `item.<path>` / `index`).
 */
function appWithLayoutRepeat(
    itemsBinding: BindingDefinition,
    childValue: BindingDefinition,
    repeatLayoutId: string,
    keyField?: string
): AppModel {
    return {
        id: "app",
        name: "App",
        layouts: [
            { id: "main", slots: [{ name: "content" }] },
            { id: repeatLayoutId, slots: [{ name: "content" }] }
        ],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "rep",
                kind: "repeat",
                mount: "route:/home/content",
                order: 0,
                bind: { items: itemsBinding },
                props: keyField ? { layoutId: repeatLayoutId, keyField } : { layoutId: repeatLayoutId },
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

function contentComponents(app: ReturnType<typeof createRendererApp>): RenderedComponent[] {
    const region = app.render().regions.find((candidate) => candidate.name === "content");
    return region ? region.components : [];
}

const ROWS = [{ name: "Ada" }, { name: "Linus" }, { name: "Grace" }];

describe("P191 — ui-repeat own content-slot layout", () => {
    it("renders one container-kind component per item, each carrying the repeat's layoutId", () => {
        const app = createRendererApp(
            appWithLayoutRepeat(
                { kind: "literal", value: ROWS },
                { kind: "item", path: "name" },
                "grid"
            ),
            { integration: NO_INTEGRATION }
        );

        const components = contentComponents(app);
        expect(components).toHaveLength(3);
        for (const component of components) {
            expect(component.kind).toBe("container");
            expect((component as RenderedContainerComponent).layoutId).toBe("grid");
        }
    });

    it("places the cloned per-item children UNDER the layout's content region with the item scope intact", () => {
        const app = createRendererApp(
            appWithLayoutRepeat(
                { kind: "literal", value: ROWS },
                { kind: "item", path: "name" },
                "grid"
            ),
            { integration: NO_INTEGRATION }
        );

        const containers = contentComponents(app) as RenderedContainerComponent[];
        const texts = containers.map((container) => {
            const region = container.regions.find((candidate) => candidate.name === "content");
            const child = region?.components[0] as RenderedTextComponent | undefined;
            return child?.text;
        });

        // Each item's child resolves item.name against ITS frame — proving the
        // children sit under the layout region AND keep the per-instance item scope.
        expect(texts).toEqual(["Ada", "Linus", "Grace"]);
    });

    it("keys each per-item container by itemKey × repeatId (keyed morph identity)", () => {
        const app = createRendererApp(
            appWithLayoutRepeat(
                { kind: "literal", value: [{ id: "a", name: "Ada" }, { id: "b", name: "Linus" }] },
                { kind: "item", path: "name" },
                "vertical",
                "id"
            ),
            { integration: NO_INTEGRATION }
        );

        const ids = contentComponents(app).map((component) => component.id);
        expect(ids).toEqual(["a#rep", "b#rep"]);
    });

    it("an empty array renders zero per-item containers", () => {
        const app = createRendererApp(
            appWithLayoutRepeat({ kind: "literal", value: [] }, { kind: "item", path: "name" }, "grid"),
            { integration: NO_INTEGRATION }
        );

        expect(contentComponents(app)).toHaveLength(0);
    });

    it("a repeat WITHOUT a layoutId keeps the legacy flat behaviour (children flatten into the host region)", () => {
        const app = createRendererApp(
            {
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
                        props: {},
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
            },
            { integration: NO_INTEGRATION }
        );

        const components = contentComponents(app);
        expect(components.map((component) => component.kind)).toEqual(["text", "text", "text"]);
        expect(components.map((component) => (component as RenderedTextComponent).text)).toEqual(["Ada", "Linus", "Grace"]);
    });
});
