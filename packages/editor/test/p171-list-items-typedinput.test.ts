import { describe, expect, it } from "vitest";

import { emitNodeDefinition } from "../src";

/**
 * P171 (ADR 0012) — ui-list: `items` becomes a STRUCTURAL array value typedInput
 * (store/query/reactive/json-literal). The editor mapper compiles those binding
 * objects into the schema `items` field, migrating the legacy `itemsPath` plain
 * state path to `{ kind:"state", path }` (PRECISE: a leading `state.` is stripped).
 * `displayValue` / `badgeVariant` are node-wide display fields.
 */
function mapList(config: Record<string, unknown>) {
    const result = emitNodeDefinition("ui-list", { id: "l1", mount: "route:/x/content", ...config } as never);
    if (!result.success) {
        throw new Error("ui-list emit failed: " + result.error);
    }
    return result.data as unknown as {
        type: string;
        items: unknown;
        displayValue?: string;
        badgeVariant?: string;
    };
}

describe("P171: ui-list editor mapper — items (structural array) + migration + display", () => {
    it("json-literal items binding is unwrapped to a static array (mixed string/object)", () => {
        const items = ["Ada", { id: "c-1", label: "Open", value: 3 }];
        const def = mapList({ items: { kind: "literal", value: items } });
        expect(def.items).toEqual(items);
    });

    it("a store items binding passes through unchanged (structural resolution)", () => {
        const sub = { kind: "store", path: "people", subPath: { kind: "literal", value: "rows" } };
        const def = mapList({ items: sub });
        expect(def.items).toEqual(sub);
    });

    it("a bare array (flow.json/tests) is kept as a static array", () => {
        const items = [{ label: "A" }];
        const def = mapList({ items });
        expect(def.items).toEqual(items);
    });

    it("migration — legacy itemsPath becomes a state binding (whole string is the path)", () => {
        const def = mapList({ itemsPath: "people" });
        expect(def.items).toEqual({ kind: "state", path: "people" });
    });

    it("migration — a leading `state.` prefix is stripped (never state.state.…)", () => {
        const def = mapList({ itemsPath: "state.foo.bar" });
        expect(def.items).toEqual({ kind: "state", path: "foo.bar" });
    });

    it("displayValue + badgeVariant compile through to the definition", () => {
        const def = mapList({ items: { kind: "literal", value: [] }, displayValue: "badge", badgeVariant: "warning" });
        expect(def.displayValue).toBe("badge");
        expect(def.badgeVariant).toBe("warning");
    });
});
