import { describe, expect, it } from "vitest";

import { validateUiNodeDefinition } from "../src";

/**
 * P171 — the ui-list item-schema contract. A static `items` array element is a
 * String shorthand (→ {label}) OR an object {id?,label,value?,icon?}; `label` is
 * required (object form); `value` is String|Number; a mixed array is valid. The
 * node carries node-wide `displayValue` (none/secondary/badge) and `badgeVariant`.
 */
function makeList(extra: Record<string, unknown>) {
    return validateUiNodeDefinition({
        type: "ui-list",
        id: "list1",
        mount: "route:/x/content",
        ...extra
    });
}

describe("P171: ui-list item-schema + display fields", () => {
    it("accepts a mixed array of String shorthands and item objects", () => {
        const result = makeList({
            items: ["Ada", { id: "c-1", label: "Open", value: 3, icon: "file" }, { label: "Paid", value: "twelve" }]
        });
        expect(result.success).toBe(true);
    });

    it("accepts a numeric value on an item object", () => {
        expect(makeList({ items: [{ label: "Open", value: 7 }] }).success).toBe(true);
    });

    it("rejects an item object missing the required label", () => {
        const result = makeList({ items: [{ id: "c-1", value: 3 }] });
        expect(result.success).toBe(false);
    });

    it("accepts a binding object for items (structural source)", () => {
        expect(makeList({ items: { kind: "store", path: "people" } }).success).toBe(true);
    });

    it("accepts displayValue + badgeVariant", () => {
        expect(makeList({ items: [], displayValue: "badge", badgeVariant: "warning" }).success).toBe(true);
    });

    it("rejects an unknown displayValue", () => {
        expect(makeList({ items: [], displayValue: "huge" }).success).toBe(false);
    });

    it("rejects an unknown badgeVariant", () => {
        expect(makeList({ items: [], displayValue: "badge", badgeVariant: "purple" }).success).toBe(false);
    });
});
