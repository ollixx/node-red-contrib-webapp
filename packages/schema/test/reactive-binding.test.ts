import { describe, expect, it } from "vitest";

import { bindingSchema, reactiveBindingFixture, storeDefinitionSchema } from "../src/index";

/**
 * P115 (ADR 0010) — schema half of the `reactive` binding kind.
 *
 * A `reactive` binding carries the expression SOURCE in `value` (a non-empty
 * string), not a `path`. See docs/nodes/concepts/reactive-expressions.md.
 */
describe("P115 reactive binding schema", () => {
    it("accepts a reactive binding with a non-empty expression in value", () => {
        const result = bindingSchema.safeParse({
            kind: "reactive",
            value: "`Kunde ${routeParam.id}`"
        });

        expect(result.success).toBe(true);
    });

    it("rejects a reactive binding without value", () => {
        const result = bindingSchema.safeParse({ kind: "reactive" });

        expect(result.success).toBe(false);
    });

    it("rejects a reactive binding with an empty value", () => {
        const result = bindingSchema.safeParse({ kind: "reactive", value: "" });

        expect(result.success).toBe(false);
    });

    it("rejects a reactive binding with a whitespace-only value", () => {
        const result = bindingSchema.safeParse({ kind: "reactive", value: "   " });

        expect(result.success).toBe(false);
    });

    it("rejects a reactive binding whose value is not a string", () => {
        const result = bindingSchema.safeParse({ kind: "reactive", value: 42 });

        expect(result.success).toBe(false);
    });

    it("does not require a path for a reactive binding", () => {
        const result = bindingSchema.safeParse({
            kind: "reactive",
            value: "routeParam.id"
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.path).toBeUndefined();
        }
    });

    it("exposes a canonical reactive fixture", () => {
        const result = bindingSchema.safeParse(reactiveBindingFixture);

        expect(result.success).toBe(true);
        expect(reactiveBindingFixture.kind).toBe("reactive");
        expect(reactiveBindingFixture.value).toBe("`Kunde ${routeParam.id}`");
    });

    it("carries an optional store name for store(name) resolution", () => {
        const named = storeDefinitionSchema.safeParse({
            id: "draftStore",
            name: "customer",
            statePath: "draft.customer"
        });
        const unnamed = storeDefinitionSchema.safeParse({
            id: "draftStore",
            statePath: "draft.customer"
        });

        expect(named.success).toBe(true);
        expect(unnamed.success).toBe(true);
    });
});
