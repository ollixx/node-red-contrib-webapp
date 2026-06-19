import { describe, expect, it } from "vitest";

import {
    bindingSchema,
    leafBindingSchema,
    uiRepeatNodeDefinitionSchema,
    validateUiNodeDefinition
} from "../src";

// P193 (ADR 0023) — named repeat scopes. SCHEMA layer: a ui-repeat may NAME its
// scope via an optional `itemName`; `item`/`index` bindings gain an optional
// `scope` qualifier (= a repeat alias). FORM only — the renderer resolves the
// named frame (P193 renderer test). Backward compatible: no itemName / no scope →
// today's behaviour verbatim.

describe("P193 (ADR 0023): ui-repeat itemName alias", () => {
    const baseRepeat = {
        type: "ui-repeat" as const,
        id: "customerRepeat",
        mount: "repeatApp.content",
        items: { kind: "literal" as const, value: [{ name: "Ada" }] }
    };

    it("accepts a ui-repeat with an optional itemName alias", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse({ ...baseRepeat, itemName: "customer" });
        expect(result.success).toBe(true);
    });

    it("still validates a ui-repeat WITHOUT an itemName (optional — backward compatible)", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse(baseRepeat);
        expect(result.success).toBe(true);
    });

    it("rejects an EMPTY-STRING itemName (set means non-empty)", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse({ ...baseRepeat, itemName: "" });
        expect(result.success).toBe(false);
    });

    it("is reachable through the discriminated dispatch with an itemName", () => {
        const result = validateUiNodeDefinition({ ...baseRepeat, itemName: "customer" });
        expect(result.success).toBe(true);
    });
});

describe("P193 (ADR 0023): scope-qualified item / index bindings", () => {
    it("accepts a scope-qualified item binding ({kind:item, scope, path})", () => {
        const result = bindingSchema.safeParse({ kind: "item", scope: "customer", path: "name" });
        expect(result.success).toBe(true);
    });

    it("accepts a scope-qualified whole-item binding (scope, no path)", () => {
        const result = bindingSchema.safeParse({ kind: "item", scope: "customer" });
        expect(result.success).toBe(true);
    });

    it("accepts a scope-qualified index binding ({kind:index, scope})", () => {
        const result = bindingSchema.safeParse({ kind: "index", scope: "customer" });
        expect(result.success).toBe(true);
    });

    it("keeps an UNSCOPED item binding valid (innermost — unchanged)", () => {
        expect(bindingSchema.safeParse({ kind: "item", path: "name" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "item" }).success).toBe(true);
    });

    it("still enforces the dotted-path FORM on a scoped item path", () => {
        expect(bindingSchema.safeParse({ kind: "item", scope: "customer", path: ".name" }).success).toBe(false);
        expect(bindingSchema.safeParse({ kind: "item", scope: "customer", path: "a..b" }).success).toBe(false);
    });

    it("still rejects a scoped index that carries a path", () => {
        expect(bindingSchema.safeParse({ kind: "index", scope: "customer", path: "name" }).success).toBe(false);
    });

    it("rejects a scope qualifier on a NON item/index kind (state)", () => {
        expect(bindingSchema.safeParse({ kind: "state", scope: "customer", path: "x" }).success).toBe(false);
    });

    it("round-trips a scoped item binding through parse → serialize → parse", () => {
        const input = { kind: "item", scope: "customer", path: "address.city" };
        const parsed = bindingSchema.parse(input);
        const roundTripped = bindingSchema.parse(JSON.parse(JSON.stringify(parsed)));
        expect(roundTripped).toEqual({ kind: "item", scope: "customer", path: "address.city" });
    });

    it("accepts a scoped item binding inside leafBindingSchema too", () => {
        expect(leafBindingSchema.safeParse({ kind: "item", scope: "customer", path: "name" }).success).toBe(true);
        expect(leafBindingSchema.safeParse({ kind: "index", scope: "customer" }).success).toBe(true);
    });
});
