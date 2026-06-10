import { describe, expect, it } from "vitest";

import {
    bindingSchema,
    leafBindingSchema,
    storeSubPathBindingFixture
} from "../src";

describe("P131 (ADR 0013): store binding subPath schema", () => {
    it("accepts a store binding with a literal subPath", () => {
        const result = bindingSchema.safeParse({
            kind: "store",
            path: "s1",
            subPath: { kind: "literal", value: "c" }
        });

        expect(result.success).toBe(true);
    });

    it("accepts a store binding with a dynamic (routeParam) subPath", () => {
        const result = bindingSchema.safeParse({
            kind: "store",
            path: "s1",
            subPath: { kind: "routeParam", path: "key" }
        });

        expect(result.success).toBe(true);
    });

    it("accepts a store binding without a subPath (unchanged whole-slice form)", () => {
        const result = bindingSchema.safeParse({ kind: "store", path: "s1" });
        expect(result.success).toBe(true);
    });

    it("rejects a subPath that itself carries a subPath (structural recursion lock)", () => {
        const result = bindingSchema.safeParse({
            kind: "store",
            path: "s1",
            subPath: {
                kind: "store",
                path: "s2",
                subPath: { kind: "literal", value: "c" }
            }
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.message.includes("subPath"))).toBe(true);
        }
    });

    it("rejects a subPath on a non-store binding", () => {
        const result = bindingSchema.safeParse({
            kind: "state",
            path: "customers.list",
            subPath: { kind: "literal", value: "c" }
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some((issue) => issue.message.includes("only valid on a 'store' binding"))
            ).toBe(true);
        }
    });

    it("rejects a subPath on a reactive binding", () => {
        const result = bindingSchema.safeParse({
            kind: "reactive",
            value: "`x`",
            subPath: { kind: "literal", value: "c" }
        });

        expect(result.success).toBe(false);
    });

    it("validates the leaf binding directly but rejects a nested subPath on it", () => {
        expect(leafBindingSchema.safeParse({ kind: "literal", value: "c" }).success).toBe(true);
        expect(leafBindingSchema.safeParse({ kind: "routeParam", path: "key" }).success).toBe(true);
        expect(
            leafBindingSchema.safeParse({
                kind: "literal",
                value: "c",
                subPath: { kind: "literal", value: "d" }
            }).success
        ).toBe(false);
    });

    it("validates the canonical store-subPath fixture", () => {
        expect(bindingSchema.safeParse(storeSubPathBindingFixture).success).toBe(true);
        expect(storeSubPathBindingFixture).toEqual({
            kind: "store",
            path: "monsterStore",
            subPath: { kind: "literal", value: "c" }
        });
    });
});
