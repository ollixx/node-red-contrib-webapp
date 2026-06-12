import { describe, expect, it } from "vitest";

import {
    bindingSchema,
    SCOPE_LOCAL_BINDING_KINDS,
    uiRepeatNodeDefinitionSchema,
    REPEAT_SLOT,
    validateUiNodeDefinition,
    itemBindingFixture,
    indexBindingFixture,
    minimalRepeatNodeSetFixture
} from "../src";

// P163 (ADR 0017) — Schicht 1 of the ui-repeat wave. SCHEMA only: the node
// definition + the new scope-local binding FORM (`item`/`index`). No renderer,
// no resolution here.

describe("P163 (ADR 0017): ui-repeat node definition", () => {
    const baseRepeat = {
        type: "ui-repeat" as const,
        id: "customerRepeat",
        mount: "repeatApp.content",
        items: { kind: "literal" as const, value: [{ name: "Ada" }] }
    };

    it("validates a ui-repeat with required items, optional keyField and a default slot", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse({ ...baseRepeat, keyField: "id" });
        expect(result.success).toBe(true);
    });

    it("accepts a ui-repeat without a keyField (optional)", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse(baseRepeat);
        expect(result.success).toBe(true);
    });

    it("rejects a ui-repeat missing the required items binding", () => {
        const { items: _items, ...withoutItems } = baseRepeat;
        const result = uiRepeatNodeDefinitionSchema.safeParse(withoutItems);
        expect(result.success).toBe(false);
    });

    it("accepts a dynamic (state) items binding", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse({
            ...baseRepeat,
            items: { kind: "state", path: "ui.customers" }
        });
        expect(result.success).toBe(true);
    });

    it("rejects an empty-string keyField", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse({ ...baseRepeat, keyField: "" });
        expect(result.success).toBe(false);
    });

    it("requires a mount or parent (container-mountable, like ui-container)", () => {
        const { mount: _mount, ...floating } = baseRepeat;
        const result = uiRepeatNodeDefinitionSchema.safeParse(floating);
        expect(result.success).toBe(false);
    });

    it("is reachable through the discriminated dispatch (validateUiNodeDefinition)", () => {
        const result = validateUiNodeDefinition({ ...baseRepeat, keyField: "id" });
        expect(result.success).toBe(true);
    });

    it("exposes the fixed default slot name 'content' (REPEAT_SLOT)", () => {
        expect(REPEAT_SLOT).toBe("content");
    });
});

describe("P163 (ADR 0017): scope-local binding kinds item / index", () => {
    it("declares item and index as the scope-local kinds", () => {
        expect([...SCOPE_LOCAL_BINDING_KINDS]).toEqual(["item", "index"]);
    });

    it("accepts a bare `item` binding (whole current element)", () => {
        const result = bindingSchema.safeParse({ kind: "item" });
        expect(result.success).toBe(true);
    });

    it("accepts a one-level `item.<path>` field binding", () => {
        const result = bindingSchema.safeParse({ kind: "item", path: "name" });
        expect(result.success).toBe(true);
    });

    it("accepts a multi-level `item.<path>` field binding (item.address.city)", () => {
        const result = bindingSchema.safeParse({ kind: "item", path: "address.city" });
        expect(result.success).toBe(true);
    });

    it("rejects a malformed item path (leading dot)", () => {
        const result = bindingSchema.safeParse({ kind: "item", path: ".name" });
        expect(result.success).toBe(false);
    });

    it("rejects a malformed item path (double dot)", () => {
        const result = bindingSchema.safeParse({ kind: "item", path: "address..city" });
        expect(result.success).toBe(false);
    });

    it("treats an 'item' path segment as a literal field name, not a stripped prefix", () => {
        // The prefix is the KIND; the `path` is the field tail. `item.name` is a
        // legitimate two-level field path (element.item.name), not a redundant
        // prefix — the FORM check cannot (and must not) special-case a field that
        // happens to be named `item`.
        const result = bindingSchema.safeParse({ kind: "item", path: "item.name" });
        expect(result.success).toBe(true);
    });

    it("accepts a bare `index` binding (zero-based position, path-free)", () => {
        const result = bindingSchema.safeParse({ kind: "index" });
        expect(result.success).toBe(true);
    });

    it("rejects an `index` binding that carries a path", () => {
        const result = bindingSchema.safeParse({ kind: "index", path: "name" });
        expect(result.success).toBe(false);
    });

    it("round-trips an item.<path> binding through parse → serialize → parse", () => {
        const input = { kind: "item", path: "address.city" };
        const parsed = bindingSchema.parse(input);
        const roundTripped = bindingSchema.parse(JSON.parse(JSON.stringify(parsed)));
        expect(roundTripped).toEqual({ kind: "item", path: "address.city" });
    });

    it("rejects a binding with an UNKNOWN kind (negative test)", () => {
        const result = bindingSchema.safeParse({ kind: "scope", path: "name" });
        expect(result.success).toBe(false);
    });
});

describe("P163 (ADR 0017): fixtures", () => {
    it("the item / index binding fixtures parse", () => {
        expect(bindingSchema.safeParse(itemBindingFixture).success).toBe(true);
        expect(bindingSchema.safeParse(indexBindingFixture).success).toBe(true);
    });

    it("the minimal repeat node-set fixture validates every node", () => {
        for (const node of minimalRepeatNodeSetFixture) {
            const result = validateUiNodeDefinition(node);
            expect(result.success, `node ${node.id} should validate`).toBe(true);
        }
    });

    it("the minimal repeat fixture wires a child `item.name` binding into the repeat slot", () => {
        const child = minimalRepeatNodeSetFixture.find((node) => node.id === "customerName");
        expect(child).toBeDefined();
        expect((child as { mount?: string }).mount).toBe("customerRepeat.content");
    });
});
