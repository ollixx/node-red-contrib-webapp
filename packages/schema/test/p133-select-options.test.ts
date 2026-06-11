import { describe, expect, it } from "vitest";

import { normalizeSelectOptions, uiSelectNodeDefinitionSchema } from "../src/index";

/**
 * P133 — ui-select Options validation/normalisation as a pure function.
 *
 * `normalizeSelectOptions` is the single source of truth shared by the editor's
 * `json`-type Options field, the runtime mapper, and these tests. It accepts
 * exactly three forms and rejects everything else with a spoken error.
 */
describe("P133 normalizeSelectOptions — three accepted forms", () => {
    it("Form 1: object map { label: value } → [{label,value}]", () => {
        const result = normalizeSelectOptions({ Germany: "de", France: "fr" });
        expect(result).toEqual({
            ok: true,
            options: [
                { label: "Germany", value: "de" },
                { label: "France", value: "fr" }
            ]
        });
    });

    it("Form 2: array of strings → value = label", () => {
        const result = normalizeSelectOptions(["A", "B"]);
        expect(result).toEqual({
            ok: true,
            options: [
                { label: "A", value: "A" },
                { label: "B", value: "B" }
            ]
        });
    });

    it("Form 3: array of {label,value} objects → unchanged", () => {
        const result = normalizeSelectOptions([
            { label: "EN", value: "en" },
            { label: "DE", value: "de" }
        ]);
        expect(result).toEqual({
            ok: true,
            options: [
                { label: "EN", value: "en" },
                { label: "DE", value: "de" }
            ]
        });
    });

    it("object values may be numbers/booleans (scalars)", () => {
        const result = normalizeSelectOptions({ One: 1, Yes: true });
        expect(result).toEqual({
            ok: true,
            options: [
                { label: "One", value: 1 },
                { label: "Yes", value: true }
            ]
        });
    });

    it("empty array and empty object normalise to []", () => {
        expect(normalizeSelectOptions([])).toEqual({ ok: true, options: [] });
        expect(normalizeSelectOptions({})).toEqual({ ok: true, options: [] });
    });

    it("null/undefined normalise to []", () => {
        expect(normalizeSelectOptions(null)).toEqual({ ok: true, options: [] });
        expect(normalizeSelectOptions(undefined)).toEqual({ ok: true, options: [] });
    });
});

describe("P133 normalizeSelectOptions — rejected structures", () => {
    it("rejects an array of numbers ([1,2,3])", () => {
        const result = normalizeSelectOptions([1, 2, 3]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/all strings|all objects/i);
        }
    });

    it("rejects an object whose values are objects ({a:{}})", () => {
        const result = normalizeSelectOptions({ a: {} });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/scalar/i);
        }
    });

    it("rejects an array of objects missing 'value'", () => {
        const result = normalizeSelectOptions([{ label: "A" }]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/value/i);
        }
    });

    it("rejects an array of objects missing 'label'", () => {
        const result = normalizeSelectOptions([{ value: "a" }]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/label/i);
        }
    });

    it("rejects a bare scalar (string/number/boolean)", () => {
        expect(normalizeSelectOptions("nope").ok).toBe(false);
        expect(normalizeSelectOptions(42).ok).toBe(false);
        expect(normalizeSelectOptions(true).ok).toBe(false);
    });

    it("rejects a mixed array (string + object)", () => {
        const result = normalizeSelectOptions(["A", { label: "B", value: "b" }]);
        expect(result.ok).toBe(false);
    });
});

describe("P133 ui-select schema — label/placeholder bindings, no searchable", () => {
    const base = {
        type: "ui-select" as const,
        id: "sel1",
        mount: "app1.content",
        value: { kind: "literal", value: "de" }
    };

    it("accepts a literal-string label and placeholder (back-compat)", () => {
        const parsed = uiSelectNodeDefinitionSchema.parse({
            ...base,
            label: "Country",
            placeholder: "Pick one"
        });
        expect(parsed.label).toBe("Country");
        expect(parsed.placeholder).toBe("Pick one");
    });

    it("accepts a binding-object label and placeholder", () => {
        const parsed = uiSelectNodeDefinitionSchema.parse({
            ...base,
            label: { kind: "store", path: "labelStore" },
            placeholder: { kind: "query", path: "hint" }
        });
        expect(parsed.label).toEqual({ kind: "store", path: "labelStore" });
        expect(parsed.placeholder).toEqual({ kind: "query", path: "hint" });
    });

    it("ignores a legacy `searchable` field (stripped, no error)", () => {
        const parsed = uiSelectNodeDefinitionSchema.parse({
            ...base,
            label: "Country",
            searchable: true
        } as Record<string, unknown>);
        expect((parsed as Record<string, unknown>).searchable).toBeUndefined();
    });
});
