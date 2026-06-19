import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P189 — the value-binding carrier field's `required: true` was TYPE-BLIND: it
 * marked an empty `item`/`index`/`prop` path red even though an empty path is
 * legitimate there (whole element / bare index / whole prop, per P184), while a
 * data-binding kind (state/query/…) genuinely requires a non-empty path.
 *
 * This pins the pure core `isValueBindingValueValid(type, value)` that the
 * type-aware `validateValueBindingField` factory delegates to. Pure — no DOM.
 */

interface EditorCommon {
    isValueBindingValueValid: (type: string, value: unknown) => boolean;
}

let common: EditorCommon;

beforeAll(() => {
    const editorCommonPath = fileURLToPath(
        new URL("../../../resources/lib/editor-common.js", import.meta.url)
    );
    const source = readFileSync(editorCommonPath, "utf8");
    const sandbox: Record<string, unknown> = {};
    sandbox.window = sandbox;
    createContext(sandbox);
    runInContext(source, sandbox);
    common = sandbox.WebappEditorCommon as EditorCommon;
});

describe("P189: isValueBindingValueValid — scope-local kinds allow empty", () => {
    it("item with an empty path is VALID (whole element)", () => {
        expect(common.isValueBindingValueValid("item", "")).toBe(true);
        expect(common.isValueBindingValueValid("item", "   ")).toBe(true);
        expect(common.isValueBindingValueValid("item", null)).toBe(true);
        expect(common.isValueBindingValueValid("item", undefined)).toBe(true);
    });

    it("item with a dotted field path is VALID", () => {
        expect(common.isValueBindingValueValid("item", "name")).toBe(true);
        expect(common.isValueBindingValueValid("item", "address.city")).toBe(true);
    });

    it("item with a malformed path is INVALID", () => {
        expect(common.isValueBindingValueValid("item", "1bad")).toBe(false);
        expect(common.isValueBindingValueValid("item", "a..b")).toBe(false);
    });

    it("index is path-free — always VALID", () => {
        expect(common.isValueBindingValueValid("index", "")).toBe(true);
        expect(common.isValueBindingValueValid("index", "0")).toBe(true);
    });

    it("prop with an empty path is VALID (whole prop)", () => {
        expect(common.isValueBindingValueValid("prop", "")).toBe(true);
    });

    it("prop with a dotted field path is VALID", () => {
        expect(common.isValueBindingValueValid("prop", "user.name")).toBe(true);
    });
});

describe("P189: isValueBindingValueValid — data kinds still require a value", () => {
    it("query with an empty path is INVALID", () => {
        expect(common.isValueBindingValueValid("query", "")).toBe(false);
        expect(common.isValueBindingValueValid("query", null)).toBe(false);
    });

    it("query with a non-empty path is VALID", () => {
        expect(common.isValueBindingValueValid("query", "customers.total")).toBe(true);
    });

    it("store/state/routeParam with an empty value are INVALID", () => {
        expect(common.isValueBindingValueValid("store", "")).toBe(false);
        expect(common.isValueBindingValueValid("state", "")).toBe(false);
        expect(common.isValueBindingValueValid("routeParam", "")).toBe(false);
    });

    it("a literal kind with an empty value is INVALID", () => {
        expect(common.isValueBindingValueValid("str", "")).toBe(false);
        expect(common.isValueBindingValueValid("str", "hi")).toBe(true);
    });
});
