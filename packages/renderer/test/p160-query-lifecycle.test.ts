import { describe, expect, it } from "vitest";

import { customersCrudAppModelFixture, customersCrudRuntimeIntegrationFixture } from "@node-red-contrib-webapp/schema";

import { createRendererApp, findComponentInSnapshot } from "../src";

/**
 * P160 — `query` binding read convention.
 *
 *   - `query:<queryPath>`            → the loaded DATA
 *   - `query:<queryPath>.loading`    → load-state flag
 *   - `query:<queryPath>.error`      → error message
 *   - `query:<queryPath>.updatedAt`  → last-success timestamp
 *
 * The lifecycle envelope arrives as `options.queryLifecycle` keyed by queryPath;
 * the DATA tree arrives as `options.queries` (so a `query:<path>` binding resolves
 * the data, and a deeper `query:<path>.<field>` into the data still works for
 * paths that are NOT a known query path).
 */

// A text component bound to `query:<bindPath>` mounted on the customers route.
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

describe("P160 query lifecycle resolution", () => {
    it("resolves query:<path> to the DATA, not the envelope", () => {
        const app = createRendererApp(customersCrudAppModelFixture, {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers",
            queries: { customers: { list: [{ id: "c1", name: "Ada" }] } }
        });

        const table = findComponentInSnapshot(app.render(), "customersTable");
        expect(table?.kind).toBe("table");
        expect(table && "rows" in table ? table.rows : []).toHaveLength(1);
    });

    it("resolves query:<path>.error / .loading / .updatedAt to the lifecycle fields", () => {
        const app = createRendererApp(
            modelWith(
                textBoundToQuery("qErr", "customers.list.error"),
                textBoundToQuery("qLoading", "customers.list.loading"),
                textBoundToQuery("qUpdated", "customers.list.updatedAt")
            ),
            {
                integration: customersCrudRuntimeIntegrationFixture,
                location: "/customers",
                queries: { customers: { list: [] } },
                queryLifecycle: {
                    "customers.list": { loading: true, error: "Load failed", updatedAt: 1700000000000, status: "error" }
                }
            }
        );

        expect(renderedText(app, "qErr")).toBe("Load failed");
        expect(renderedText(app, "qLoading")).toBe("true");
        expect(renderedText(app, "qUpdated")).toBe("1700000000000");
    });

    it("does NOT shadow a data sub-field for an UNKNOWN query path", () => {
        // `widgets.list` is not a declared query path, so `.error` must read INTO
        // the data tree, not the lifecycle map.
        const app = createRendererApp(modelWith(textBoundToQuery("qDataField", "widgets.list.error")), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers",
            queries: { widgets: { list: { error: "in-data" } } },
            queryLifecycle: {}
        });

        expect(renderedText(app, "qDataField")).toBe("in-data");
    });

    it("lifecycle fields are undefined when no envelope is supplied", () => {
        const app = createRendererApp(modelWith(textBoundToQuery("qErr2", "customers.list.error")), {
            integration: customersCrudRuntimeIntegrationFixture,
            location: "/customers",
            queries: { customers: { list: [] } }
        });

        // undefined value → ui-text renders its empty fallback, never the literal "error".
        expect(renderedText(app, "qErr2")).not.toBe("error");
    });
});
