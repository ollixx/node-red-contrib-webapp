import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
    };
};

const { runtimeNodeRegistry } = webapp.__test__;

/**
 * P154 (ADR 0012) — ui-pagination field-typing wave 2.
 *
 * `totalPath` → `total` (canonical value typedInput, read-only source) maps to
 * the schema `totalPages` binding. `currentPagePath` → `currentPage` (canonical
 * value typedInput, two-way: read source + change-event write-back) maps to the
 * schema `page` binding. Both carry a binding OBJECT; the legacy plain-string
 * paths migrate losslessly to `{kind:"state", path}`.
 */
describe("P154: ui-pagination — total/currentPage canonical typedInputs", () => {
    const reg = runtimeNodeRegistry["ui-pagination"];

    it("canonical currentPage binding object drives page", () => {
        const def = reg.mapConfig({
            id: "pg1",
            mount: "app1.content",
            currentPage: { kind: "state", path: "customers.page" },
            total: { kind: "state", path: "customers.total" }
        }) as Record<string, unknown>;

        const page = def.page as Record<string, unknown> | undefined;
        expect(page?.kind).toBe("state");
        expect(page?.path).toBe("customers.page");
    });

    it("canonical total binding object drives totalPages", () => {
        const def = reg.mapConfig({
            id: "pg2",
            mount: "app1.content",
            currentPage: { kind: "state", path: "customers.page" },
            total: { kind: "query", path: "list.totalPages" }
        }) as Record<string, unknown>;

        const totalPages = def.totalPages as Record<string, unknown> | undefined;
        expect(totalPages?.kind).toBe("query");
        expect(totalPages?.path).toBe("list.totalPages");
    });

    it("currentPage accepts a literal binding (number)", () => {
        const def = reg.mapConfig({
            id: "pg3",
            mount: "app1.content",
            currentPage: { kind: "literal", value: 4 },
            total: { kind: "literal", value: 9 }
        }) as Record<string, unknown>;

        const page = def.page as Record<string, unknown> | undefined;
        const totalPages = def.totalPages as Record<string, unknown> | undefined;
        expect(page?.kind).toBe("literal");
        expect(page?.value).toBe(4);
        expect(totalPages?.kind).toBe("literal");
        expect(totalPages?.value).toBe(9);
    });

    it("legacy currentPagePath migrates to a state binding for page", () => {
        const def = reg.mapConfig({
            id: "pg4",
            mount: "app1.content",
            currentPagePath: "customers.page",
            totalPath: "customers.total"
        }) as Record<string, unknown>;

        const page = def.page as Record<string, unknown> | undefined;
        expect(page?.kind).toBe("state");
        expect(page?.path).toBe("customers.page");
    });

    it("legacy totalPath migrates to a state binding for totalPages", () => {
        const def = reg.mapConfig({
            id: "pg5",
            mount: "app1.content",
            currentPagePath: "customers.page",
            totalPath: "customers.total"
        }) as Record<string, unknown>;

        const totalPages = def.totalPages as Record<string, unknown> | undefined;
        expect(totalPages?.kind).toBe("state");
        expect(totalPages?.path).toBe("customers.total");
    });

    it("canonical fields win over legacy paths when both present", () => {
        const def = reg.mapConfig({
            id: "pg6",
            mount: "app1.content",
            currentPage: { kind: "store", storeId: "s", path: "page" },
            currentPagePath: "legacy.page",
            total: { kind: "store", storeId: "s", path: "total" },
            totalPath: "legacy.total"
        }) as Record<string, unknown>;

        const page = def.page as Record<string, unknown> | undefined;
        const totalPages = def.totalPages as Record<string, unknown> | undefined;
        expect(page?.kind).toBe("store");
        expect(page?.path).toBe("page");
        expect(totalPages?.kind).toBe("store");
        expect(totalPages?.path).toBe("total");
    });

    it("pageSize stays a config number → state binding from the literal", () => {
        const def = reg.mapConfig({
            id: "pg7",
            mount: "app1.content",
            currentPage: { kind: "state", path: "p" },
            total: { kind: "state", path: "t" },
            pageSize: 25
        }) as Record<string, unknown>;

        const pageSize = def.pageSize as Record<string, unknown> | undefined;
        expect(pageSize?.kind).toBe("state");
    });

    it("empty config does not throw", () => {
        expect(() => reg.mapConfig({ id: "pg8", mount: "app1.content" })).not.toThrow();
    });
});
