import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    type RenderedComponent,
    type RenderedTextComponent
} from "../src";

/**
 * P185 (ADR 0017/0020) — `item` / `index` (and `prop`) reachable INSIDE a
 * `reactive` expression with the correct PER-INSTANCE scope. Builds on P164
 * (whole-`item`/`index` bindings) and P178 (`prop` scope). The renderer injects
 * the innermost active repeat / component-instance frame into the reactive eval
 * scope of each clone, so one compiled expression yields each row its own value.
 *
 * These snapshot tests are the unit acceptance; the browser proof is the E2E.
 */

beforeEach(() => {
    __resetReactiveCache();
});

function appWithRepeat(itemsBinding: BindingDefinition, childValue: BindingDefinition): AppModel {
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
                props: {},
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

function texts(app: ReturnType<typeof createRendererApp>): string[] {
    return contentComponents(app)
        .filter((component): component is RenderedTextComponent => component.kind === "text")
        .map((component) => component.text);
}

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

describe("P185 — item/index inside a reactive expression (per-instance)", () => {
    it("a reactive `index: item.name` resolves each row's own item/index", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: [{ name: "Ada" }, { name: "Linus" }, { name: "Grace" }] },
                { kind: "reactive", value: "`Zeile ${index}: ${item.name}`" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(texts(app)).toEqual(["Zeile 0: Ada", "Zeile 1: Linus", "Zeile 2: Grace"]);
    });

    it("bare `item` is the whole element inside the reactive scope", () => {
        const app = createRendererApp(
            appWithRepeat(
                { kind: "literal", value: ["x", "y"] },
                { kind: "reactive", value: "String(item).toUpperCase()" }
            ),
            { integration: NO_INTEGRATION }
        );

        expect(texts(app)).toEqual(["X", "Y"]);
    });

    it("OUTSIDE any repeat, `item`/`index` are undefined in a reactive expression (no crash)", () => {
        const reactiveErrors: unknown[] = [];
        const app = createRendererApp(
            {
                id: "app",
                name: "App",
                layouts: [{ id: "main", slots: [{ name: "content" }] }],
                routes: [{ id: "home", path: "/home", layoutId: "main" }],
                dialogs: [],
                components: [
                    {
                        id: "lonely",
                        kind: "text",
                        mount: "route:/home/content",
                        order: 0,
                        bind: { value: { kind: "reactive", value: "String(item) + \"/\" + String(index)" } },
                        props: {},
                        events: []
                    }
                ]
            },
            {
                integration: NO_INTEGRATION,
                onReactiveError: (error) => reactiveErrors.push(error)
            }
        );

        // `String(undefined)` → "undefined"; no throw, no reactive error reported.
        expect(texts(app)).toEqual(["undefined/undefined"]);
        expect(reactiveErrors).toEqual([]);
    });
});
