import { describe, expect, it } from "vitest";

import { customersCrudAppModelFixture, customersCrudRuntimeIntegrationFixture } from "@node-red-contrib-webapp/schema";

import { createRendererApp, findComponentInSnapshot } from "../src";

/**
 * P161 — paging metadata read convention.
 *
 *   - `query:<queryPath>.totalCount` → full result size (for ui-pagination total)
 *   - `query:<queryPath>.pageCount`  → number of pages
 *
 * These join the P160 lifecycle reserved set: they resolve from
 * `options.queryLifecycle[queryPath]`, NOT from the data tree, so a known query
 * path's `.totalCount` always reads the metadata.
 */

function textBoundToQuery(id: string, bindPath: string) {
    return {
        id,
        kind: "text" as const,
        mount: "route:/customers/content",
        bind: { value: { kind: "query" as const, path: bindPath } },
        props: {},
        events: []
    };
}

function modelWith(...components: ReturnType<typeof textBoundToQuery>[]) {
    return {
        ...customersCrudAppModelFixture,
        components: [...customersCrudAppModelFixture.components, ...components]
    };
}

function renderedText(app: ReturnType<typeof createRendererApp>, id: string): unknown {
    const node = findComponentInSnapshot(app.navigate("/customers"), id);
    return node && "text" in node ? node.text : undefined;
}

describe("P161 query paging-metadata resolution", () => {
    it("resolves query:<path>.totalCount and .pageCount from the lifecycle envelope", () => {
        const app = createRendererApp(
            modelWith(
                textBoundToQuery("qTotal", "customers.list.totalCount"),
                textBoundToQuery("qPages", "customers.list.pageCount")
            ),
            {
                integration: customersCrudRuntimeIntegrationFixture,
                location: "/customers",
                queries: { customers: { list: [{ id: "c1" }] } },
                queryLifecycle: {
                    "customers.list": { loading: false, status: "success", totalCount: 42, pageCount: 5 }
                }
            }
        );

        expect(renderedText(app, "qTotal")).toBe("42");
        expect(renderedText(app, "qPages")).toBe("5");
    });

    it("does NOT shadow a data sub-field named totalCount for an UNKNOWN query path", () => {
        const app = createRendererApp(modelWith(textBoundToQuery("qDataTotal", "widgets.list.totalCount")), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers",
            queries: { widgets: { list: { totalCount: 99 } } },
            queryLifecycle: {}
        });

        expect(renderedText(app, "qDataTotal")).toBe("99");
    });
});
