import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    type RenderedComponent,
    type RenderedContainerComponent
} from "../src";

/**
 * P197 — ui-repeat is a full container after P191 (own content-slot layout), so it
 * carries the semantic container `variant` (CONTAINER_VARIANTS). The per-item
 * content-layout-region wrapper that `expandRepeat` produces (the `container`-kind
 * component per item, P191/P192) must carry the chosen `variant`, so it renders
 * through the SAME container-variant source as ui-container (P198) — NO second path.
 *
 * Unit acceptance:
 *   1. the per-item container component carries `props.variant`;
 *   2. serialized via the SHARED serializer, variant=card frames each item-region as
 *      an <sl-card>; variant=transparent adds NO chrome (plain <div>, no sl-card).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

const ROWS = [{ name: "Ada" }, { name: "Linus" }];

/**
 * A minimal app: ONE repeat (own content-slot layout + the given `variant`) in the
 * route's content slot, with ONE ui-text child bound to `item.name`.
 */
function appWithVariantRepeat(variant: string): AppModel {
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
            {
                id: "rep",
                kind: "repeat",
                mount: "route:/home/content",
                order: 0,
                bind: { items: { kind: "literal", value: ROWS } },
                // mapConfig (webapp.js) supplies layoutId + variant on props; the
                // renderer spreads repeat.props onto each per-item container.
                props: { layoutId: "vertical", variant },
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
}

function contentComponents(app: ReturnType<typeof createRendererApp>): RenderedComponent[] {
    const region = app.render().regions.find((candidate) => candidate.name === "content");
    return region ? region.components : [];
}

describe("P197 — ui-repeat variant on the per-item container wrapper", () => {
    it("stamps the repeat's variant onto every per-item container component (props.variant)", () => {
        const app = createRendererApp(appWithVariantRepeat("card"), { integration: NO_INTEGRATION });
        const containers = contentComponents(app) as RenderedContainerComponent[];
        expect(containers).toHaveLength(2);
        for (const container of containers) {
            expect(container.kind).toBe("container");
            expect(container.props.variant).toBe("card");
        }
    });

    it("variant=card → each per-item region serializes as an <sl-card> (P198 source)", () => {
        const app = createRendererApp(appWithVariantRepeat("card"), { integration: NO_INTEGRATION });
        const container = contentComponents(app)[0] as RenderedContainerComponent;
        const html = serializer.renderComponentHtml(container, "vertical", { appId: "app", location: "/home" });
        expect(html).toContain("<sl-card");
        expect(html).toContain("webapp-container--card");
    });

    it("variant=transparent → each per-item region serializes as a plain <div>, no card chrome", () => {
        const app = createRendererApp(appWithVariantRepeat("transparent"), { integration: NO_INTEGRATION });
        const container = contentComponents(app)[0] as RenderedContainerComponent;
        const html = serializer.renderComponentHtml(container, "vertical", { appId: "app", location: "/home" });
        expect(html).not.toContain("<sl-card");
        expect(html).toContain("<div");
        expect(html).toContain("webapp-container--transparent");
    });
});
