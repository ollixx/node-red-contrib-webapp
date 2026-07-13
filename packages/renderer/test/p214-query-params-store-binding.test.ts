import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, BindingDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import { __resetReactiveCache, createRendererApp, findComponentInSnapshot } from "../src";

/**
 * P214 (ADR 0030) — renderer half: a `store` binding may point at a ui-query
 * node id. It resolves to that query's implicit per-client params slice at
 * `ui.queries.<queryPath>.params` (id + one-level sub-path, ADR 0013), exactly as
 * a `store` binding to a real ui-store resolves via statePath. Measured on the
 * rendered value, not on tags.
 */

beforeEach(() => {
    __resetReactiveCache();
});

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
    } as unknown as AppModel;
}

function integrationWithQuery(): RuntimeIntegrationModel {
    return {
        stores: [],
        queries: [{ id: "entitiesQuery", queryPath: "entities" }],
        actions: [],
        navigations: []
    } as unknown as RuntimeIntegrationModel;
}

function textOf(app: ReturnType<typeof createRendererApp>): string | undefined {
    const text = findComponentInSnapshot(app.render(), "storeText");
    return text && "text" in text ? text.text : undefined;
}

describe("P214 store binding → ui-query implicit params slice", () => {
    it("store(<queryId>).page resolves to ui.queries.<path>.params.page", () => {
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "entitiesQuery", subPath: { kind: "literal", value: "page" } }),
            {
                integration: integrationWithQuery(),
                state: { ui: { queries: { entities: { params: { page: 3, sort: "name" } } } } }
            }
        );
        expect(textOf(app)).toBe("3");
    });

    it("a real ui-store binding is unaffected (query params registration does not shadow it)", () => {
        const integration: RuntimeIntegrationModel = {
            stores: [{ id: "realStore", name: "real", statePath: "draft.page" }],
            queries: [{ id: "entitiesQuery", queryPath: "entities" }],
            actions: [],
            navigations: []
        } as unknown as RuntimeIntegrationModel;
        const app = createRendererApp(
            appWithStoreText({ kind: "store", path: "realStore" }),
            {
                integration,
                state: { draft: { page: "from-real-store" }, ui: { queries: { entities: { params: { page: 99 } } } } }
            }
        );
        expect(textOf(app)).toBe("from-real-store");
    });
});
