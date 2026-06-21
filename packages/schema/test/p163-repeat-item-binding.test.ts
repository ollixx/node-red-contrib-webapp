import { describe, expect, it } from "vitest";

import {
    bindingSchema,
    leafBindingSchema,
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

    // ADR 0025: ui-repeat is TRANSPARENT — it carries NO `layout` and NO `variant`
    // (reverted from P191/P197). It only iterates; layout/chrome is an explicit
    // enclosing ui-container's job. A bare repeat (just `items`) validates.
    it("validates a transparent ui-repeat (no layout / no variant fields)", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse(baseRepeat);
        expect(result.success).toBe(true);
    });
});

describe("P163 (ADR 0017): scope-local binding kinds item / index", () => {
    it("declares item and index among the scope-local kinds", () => {
        // P177 (ADR 0020) added `prop` as a third scope-local sibling; `item`/`index`
        // remain present and unchanged.
        expect(SCOPE_LOCAL_BINDING_KINDS).toContain("item");
        expect(SCOPE_LOCAL_BINDING_KINDS).toContain("index");
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

describe("P184: scope-local bindings tolerate an EMPTY path (whole-item / bare-index)", () => {
    // The whole-`item` case: a primitive/string element bound in its entirety.
    // The editor (older builds) and a re-save can persist this as `path:''`; the
    // schema must treat an empty path identically to "no path" for the scope-local
    // kinds — without loosening the data-binding kinds.

    it("accepts a whole-`item` binding serialised WITH an empty path (path:'')", () => {
        const result = bindingSchema.safeParse({ kind: "item", path: "" });
        expect(result.success).toBe(true);
    });

    it("accepts an `index` binding serialised WITH an empty path (path:'')", () => {
        const result = bindingSchema.safeParse({ kind: "index", path: "" });
        expect(result.success).toBe(true);
    });

    it("accepts a whole-`prop` binding serialised WITH an empty path (path:'')", () => {
        const result = bindingSchema.safeParse({ kind: "prop", path: "" });
        expect(result.success).toBe(true);
    });

    it("still accepts the path-free forms ({kind} only) for item / index / prop", () => {
        expect(bindingSchema.safeParse({ kind: "item" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "index" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "prop" }).success).toBe(true);
    });

    it("an empty-path scope-local binding parses without error inside leafBindingSchema too", () => {
        expect(leafBindingSchema.safeParse({ kind: "item", path: "" }).success).toBe(true);
        expect(leafBindingSchema.safeParse({ kind: "index", path: "" }).success).toBe(true);
        expect(leafBindingSchema.safeParse({ kind: "prop", path: "" }).success).toBe(true);
    });

    // ── negatives that must STAY red ──────────────────────────────────────────

    it("still REJECTS an `index` binding that carries a real (non-empty) path", () => {
        expect(bindingSchema.safeParse({ kind: "index", path: "name" }).success).toBe(false);
    });

    it("still REJECTS an `item` path that breaks the dotted-field pattern", () => {
        expect(bindingSchema.safeParse({ kind: "item", path: ".name" }).success).toBe(false);
        expect(bindingSchema.safeParse({ kind: "item", path: "address..city" }).success).toBe(false);
    });

    it("does NOT loosen data-binding kinds: an empty path is still invalid for state/query", () => {
        // The empty-path tolerance is scoped to item/index/prop ONLY. A data kind
        // with `path:''` must remain rejected ("require a path").
        expect(bindingSchema.safeParse({ kind: "state", path: "" }).success).toBe(false);
        expect(bindingSchema.safeParse({ kind: "query", path: "" }).success).toBe(false);
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
