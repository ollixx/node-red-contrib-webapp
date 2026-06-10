import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P132 (ADR 0013) — unit coverage for the store sub-path editor helpers in
 * `resources/lib/editor-common.js`:
 *   - `defaultSliceKeySuggestions` / `parseStoreDefaultSlice` — the pure
 *     default-slice autocomplete derivation (keys of an object, indices of an
 *     array, nothing for a scalar). Soft suggestions only.
 *   - `valueBindingTypes({category:"storePath"})` — the 11-source set for the
 *     sub-path typedInput (string default).
 *   - `applyValueBinding` / `readValueBinding` carry an optional `subPath` on a
 *     store binding and round-trip it via the store-field envelope.
 *
 * The helpers are pure (no jQuery / RED), so we load the IIFE in a vm and assert
 * on the exports directly — the same harness as the P113 suite.
 */

interface TypedInputType {
    value: string;
    label?: string;
}

interface Binding {
    kind: string;
    path?: string;
    value?: unknown;
    subPath?: unknown;
}

interface ReadResult {
    type: string;
    value: string;
    subPath?: unknown;
}

interface EditorCommon {
    valueBindingTypes: (options?: { category?: string }) => Array<TypedInputType | string>;
    readValueBinding: (binding: unknown, fallbackLiteral?: string) => ReadResult;
    applyValueBinding: (type: string, value: string, subPath?: unknown) => Binding;
    defaultSliceKeySuggestions: (slice: unknown) => string[];
    parseStoreDefaultSlice: (raw: unknown) => unknown;
    encodeStoreFieldValue: (path: string, subPath: unknown) => string;
    decodeStoreFieldValue: (raw: string) => { path: string; subPath: unknown };
}

let common: EditorCommon;

function typeValues(types: Array<TypedInputType | string>): string[] {
    return types.map((t) => (typeof t === "string" ? t : t.value));
}

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

describe("P132: default-slice autocomplete derivation (pure)", () => {
    it("object default → its top-level keys, in insertion order", () => {
        expect(common.defaultSliceKeySuggestions({ a: false, b: false, c: "eins" })).toEqual([
            "a",
            "b",
            "c"
        ]);
    });

    it("array default → its indices as strings", () => {
        expect(common.defaultSliceKeySuggestions(["x", "y", "z"])).toEqual(["0", "1", "2"]);
    });

    it("scalar / null / undefined default → no suggestions (whole slice)", () => {
        expect(common.defaultSliceKeySuggestions("eins")).toEqual([]);
        expect(common.defaultSliceKeySuggestions(42)).toEqual([]);
        expect(common.defaultSliceKeySuggestions(true)).toEqual([]);
        expect(common.defaultSliceKeySuggestions(null)).toEqual([]);
        expect(common.defaultSliceKeySuggestions(undefined)).toEqual([]);
    });

    it("parses a JSON initialValue string before deriving keys", () => {
        const slice = common.parseStoreDefaultSlice('{"a":false,"b":false,"c":"eins"}');
        expect(common.defaultSliceKeySuggestions(slice)).toEqual(["a", "b", "c"]);
    });

    it("a non-JSON initialValue string is a scalar (no suggestions)", () => {
        const slice = common.parseStoreDefaultSlice("eins");
        expect(common.defaultSliceKeySuggestions(slice)).toEqual([]);
    });

    it("an empty initialValue → undefined (no suggestions)", () => {
        expect(common.parseStoreDefaultSlice("")).toBeUndefined();
        expect(common.defaultSliceKeySuggestions(common.parseStoreDefaultSlice(""))).toEqual([]);
    });
});

describe("P132: storePath category — the sub-path source set", () => {
    it("offers exactly the 11 sources in order, string default first", () => {
        const order = typeValues(common.valueBindingTypes({ category: "storePath" }));
        expect(order).toEqual([
            "str",
            "num",
            "routeParam",
            "query",
            "store",
            "reactive",
            "jsonata",
            "msg",
            "flow",
            "global",
            "env"
        ]);
        // string is the first (default) source.
        expect(order[0]).toBe("str");
    });
});

describe("P132: store binding carries an optional one-level subPath", () => {
    it("apply with no subPath → bare { kind:'store', path }", () => {
        expect(common.applyValueBinding("store", "draftStore")).toEqual({
            kind: "store",
            path: "draftStore"
        });
    });

    it("apply with a literal subPath argument → { kind:'store', path, subPath }", () => {
        expect(
            common.applyValueBinding("store", "draftStore", { kind: "literal", value: "c" })
        ).toEqual({
            kind: "store",
            path: "draftStore",
            subPath: { kind: "literal", value: "c" }
        });
    });

    it("an empty-literal subPath means the whole slice → subPath omitted", () => {
        expect(
            common.applyValueBinding("store", "draftStore", { kind: "literal", value: "" })
        ).toEqual({ kind: "store", path: "draftStore" });
    });

    it("decodes a JSON store-field envelope value into path + subPath", () => {
        const envelope = common.encodeStoreFieldValue("draftStore", { kind: "literal", value: "c" });
        expect(common.applyValueBinding("store", envelope)).toEqual({
            kind: "store",
            path: "draftStore",
            subPath: { kind: "literal", value: "c" }
        });
    });

    it("read of a store binding with subPath surfaces the structured subPath", () => {
        const read = common.readValueBinding(
            { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "c" } },
            ""
        );
        expect(read.type).toBe("store");
        expect(read.subPath).toEqual({ kind: "literal", value: "c" });
        // the envelope value carries both halves for the typedInput
        expect(common.decodeStoreFieldValue(read.value)).toEqual({
            path: "draftStore",
            subPath: { kind: "literal", value: "c" }
        });
    });

    it("round-trips a store-with-subPath through read → apply", () => {
        const stored = { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "c" } };
        const read = common.readValueBinding(stored, "");
        const reapplied = common.applyValueBinding(read.type, read.value);
        expect(reapplied).toEqual(stored);
    });

    it("round-trips a bare store (no subPath) unchanged — P113 compatibility", () => {
        const stored = { kind: "store", path: "draftStore" };
        const read = common.readValueBinding(stored, "");
        expect(read.value).toBe("draftStore");
        expect(read.subPath).toBeUndefined();
        expect(common.applyValueBinding(read.type, read.value)).toEqual(stored);
    });

    it("a non-store kind ignores the subPath argument entirely", () => {
        expect(
            common.applyValueBinding("query", "customers.total", { kind: "literal", value: "c" })
        ).toEqual({ kind: "query", path: "customers.total" });
    });
});
