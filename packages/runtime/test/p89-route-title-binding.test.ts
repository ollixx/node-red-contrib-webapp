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
 * P89 — ui-route title as bindable field.
 *
 * mapConfig must handle three title representations:
 *   1. A plain string (back-compat legacy nodes) → resolved to that string.
 *   2. A literal binding { kind:"literal", value:"..." } → resolved to the value.
 *   3. A dynamic binding { kind:"state"|"store"|..., path:"..." } → resolved to
 *      undefined (limitation: compile-time resolution only for literals).
 *   4. No title (omitted / null) → undefined.
 */

describe("P89: ui-route title binding in mapConfig", () => {
    const reg = runtimeNodeRegistry["ui-route"];

    it("plain string title (back-compat) → resolved to string", () => {
        const def = reg.mapConfig({
            id: "r1",
            path: "/customers",
            layoutId: "vertical",
            title: "Customers"
        }) as Record<string, unknown>;

        expect(def.title).toBe("Customers");
    });

    it("literal binding → resolved to the binding value string", () => {
        const def = reg.mapConfig({
            id: "r2",
            path: "/customers",
            layoutId: "vertical",
            title: { kind: "literal", value: "Customers Literal" }
        }) as Record<string, unknown>;

        expect(def.title).toBe("Customers Literal");
    });

    it("state binding → resolves to undefined at compile time", () => {
        const def = reg.mapConfig({
            id: "r3",
            path: "/customers",
            layoutId: "vertical",
            title: { kind: "state", path: "app.pageTitle" }
        }) as Record<string, unknown>;

        expect(def.title).toBeUndefined();
    });

    it("store binding → resolves to undefined at compile time", () => {
        const def = reg.mapConfig({
            id: "r4",
            path: "/customers",
            layoutId: "vertical",
            title: { kind: "store", path: "myStoreId" }
        }) as Record<string, unknown>;

        expect(def.title).toBeUndefined();
    });

    it("msg binding → resolves to undefined at compile time", () => {
        const def = reg.mapConfig({
            id: "r5",
            path: "/customers",
            layoutId: "vertical",
            title: { kind: "msg", path: "payload.title" }
        }) as Record<string, unknown>;

        expect(def.title).toBeUndefined();
    });

    it("no title → undefined", () => {
        const def = reg.mapConfig({
            id: "r6",
            path: "/customers",
            layoutId: "vertical"
        }) as Record<string, unknown>;

        expect(def.title).toBeUndefined();
    });

    it("null title → undefined", () => {
        const def = reg.mapConfig({
            id: "r7",
            path: "/customers",
            layoutId: "vertical",
            title: null
        }) as Record<string, unknown>;

        expect(def.title).toBeUndefined();
    });

    it("empty literal binding → undefined (no blank title in compiled model)", () => {
        const def = reg.mapConfig({
            id: "r8",
            path: "/customers",
            layoutId: "vertical",
            title: { kind: "literal", value: "" }
        }) as Record<string, unknown>;

        expect(def.title).toBeUndefined();
    });
});
