import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P113 (ADR 0012 / ADR 0010) — unit coverage for the ONE canonical value-binding
 * type set and its serialisation helpers. The helper is the single source of
 * truth for the editor type list (order + kind) AND for read/apply serialisation,
 * so a single test pins the contract every in-scope display node must follow.
 *
 * `resources/lib/editor-common.js` is a browser IIFE. `valueBindingTypes`,
 * `readValueBinding` and `applyValueBinding` are pure (no jQuery / RED beyond the
 * stubs below), so we load the file in a vm and assert on the exports directly.
 */

interface TypedInputType {
    value: string;
    label?: string;
}

interface Binding {
    kind: string;
    path?: string;
    value?: unknown;
}

interface EditorCommon {
    valueBindingTypes: (options?: {
        category?: "value" | "boolean" | "url" | "display" | "structural" | "storePath";
        literalLabel?: string;
        includeAsset?: boolean;
        appId?: string;
        // P182: explicit scope gating + current-kind preservation.
        scope?: { repeat?: boolean; componentDef?: boolean };
        currentKind?: string;
    }) => Array<TypedInputType | string>;
    readValueBinding: (binding: unknown, fallbackLiteral?: string) => { type: string; value: string };
    applyValueBinding: (type: string, value: string) => Binding;
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

// The 14 canonical global value kinds in their established order — the base set
// every value/display field offers regardless of scope (P182 gates the
// scope-local item/index/prop kinds OUT of this base unless inside their
// container).
const BASE_VALUE_SET = [
    "store",
    "query",
    "routeParam",
    "reactive",
    "msg",
    "jsonata",
    "str",
    "num",
    "bool",
    "json",
    "date",
    "flow",
    "global",
    "env"
];

describe("P113: canonical value-binding type set", () => {
    it("value category (default) offers the 14 canonical global types in order — no scope-local kinds outside a scope (P182)", () => {
        // P182: with no DOM/editor scope (the vm has no `$`/`RED`), the scope is
        // unknown → both-false → the scope-local item/index/prop kinds are gated
        // OUT. The base set is exactly the 14 global kinds.
        const order = typeValues(common.valueBindingTypes());
        expect(order).toEqual(BASE_VALUE_SET);
    });

    it("the scope-local item/index/prop kinds are ABSENT from the value set when out of scope (P182)", () => {
        const order = typeValues(common.valueBindingTypes());
        expect(order).not.toContain("item");
        expect(order).not.toContain("index");
        expect(order).not.toContain("prop");
    });

    it("scope-local item/index are NOT offered in the boolean or url categories (P165)", () => {
        for (const category of ["boolean", "url"] as const) {
            const order = typeValues(common.valueBindingTypes({ category }));
            expect(order).not.toContain("item");
            expect(order).not.toContain("index");
        }
    });

    it("an undeclared category defaults to the full value set (safe default)", () => {
        expect(typeValues(common.valueBindingTypes())).toEqual(
            typeValues(common.valueBindingTypes({ category: "value" }))
        );
    });

    it("does NOT offer `state` in any category (owner decision: out of the set)", () => {
        for (const category of ["value", "boolean", "url"] as const) {
            expect(typeValues(common.valueBindingTypes({ category }))).not.toContain("state");
        }
    });

    it("default editor type is the string literal (`str`)", () => {
        // readValueBinding of an empty / absent binding lands on the str literal.
        expect(common.readValueBinding(undefined, "")).toEqual({ type: "str", value: "" });
    });

    it("boolean-state category drops string/number/json/timestamp literals", () => {
        const order = typeValues(common.valueBindingTypes({ category: "boolean" }));
        expect(order).toEqual([
            "store",
            "query",
            "routeParam",
            "reactive",
            "msg",
            "jsonata",
            "bool",
            "flow",
            "global",
            "env"
        ]);
        expect(order).not.toContain("str");
        expect(order).not.toContain("num");
        expect(order).not.toContain("json");
        expect(order).not.toContain("date");
    });

    it("url/path category keeps str + reactive sources, drops num/bool/json/date", () => {
        const order = typeValues(common.valueBindingTypes({ category: "url" }));
        expect(order).toEqual([
            "str",
            "msg",
            "jsonata",
            "store",
            "reactive",
            "flow",
            "global",
            "env"
        ]);
        expect(order).not.toContain("num");
        expect(order).not.toContain("bool");
        expect(order).not.toContain("json");
        expect(order).not.toContain("date");
    });
});

// ── P182 — scope-local binding kinds are context-gated ────────────────────────
// item/index appear ONLY inside a ui-repeat; prop ONLY inside a
// ui-component-definition. The scope is injected explicitly here (`scope`) since
// the vm has no live editor DOM. `currentKind` re-includes the matching kind so
// an already-saved out-of-scope binding stays editable.
describe("P182: context-gated scope-local kinds", () => {
    it("scope.repeat=true appends item/index (and NOT prop) at the tail", () => {
        const order = typeValues(
            common.valueBindingTypes({ category: "value", scope: { repeat: true } })
        );
        expect(order).toEqual([...BASE_VALUE_SET, "item", "index"]);
        expect(order).not.toContain("prop");
    });

    it("scope.componentDef=true appends prop (and NOT item/index) at the tail", () => {
        const order = typeValues(
            common.valueBindingTypes({ category: "value", scope: { componentDef: true } })
        );
        expect(order).toEqual([...BASE_VALUE_SET, "prop"]);
        expect(order).not.toContain("item");
        expect(order).not.toContain("index");
    });

    it("both scopes true appends item, index, then prop in canonical tail order", () => {
        const order = typeValues(
            common.valueBindingTypes({ category: "value", scope: { repeat: true, componentDef: true } })
        );
        expect(order).toEqual([...BASE_VALUE_SET, "item", "index", "prop"]);
    });

    it("an empty scope ({}) gates ALL scope-local kinds out (base set only)", () => {
        const order = typeValues(common.valueBindingTypes({ category: "value", scope: {} }));
        expect(order).toEqual(BASE_VALUE_SET);
    });

    it("currentKind='item' re-includes item/index even out of scope (existing binding stays editable)", () => {
        const order = typeValues(
            common.valueBindingTypes({ category: "value", scope: {}, currentKind: "item" })
        );
        expect(order).toContain("item");
        expect(order).toContain("index");
        expect(order).not.toContain("prop");
    });

    it("currentKind='index' re-includes item/index even out of scope", () => {
        const order = typeValues(
            common.valueBindingTypes({ category: "value", scope: {}, currentKind: "index" })
        );
        expect(order).toContain("item");
        expect(order).toContain("index");
    });

    it("currentKind='prop' re-includes prop even out of scope", () => {
        const order = typeValues(
            common.valueBindingTypes({ category: "value", scope: {}, currentKind: "prop" })
        );
        expect(order).toContain("prop");
        expect(order).not.toContain("item");
        expect(order).not.toContain("index");
    });

    it("the display category is gated identically to value (scope-local kinds excluded out of scope)", () => {
        const outOfScope = typeValues(common.valueBindingTypes({ category: "display", scope: {} }));
        expect(outOfScope).not.toContain("item");
        expect(outOfScope).not.toContain("index");
        expect(outOfScope).not.toContain("prop");
        const inRepeat = typeValues(
            common.valueBindingTypes({ category: "display", scope: { repeat: true } })
        );
        expect(inRepeat).toContain("item");
        expect(inRepeat).toContain("index");
    });

    it("boolean/url/structural/storePath categories never carry scope-local kinds, even in scope", () => {
        for (const category of ["boolean", "url", "structural", "storePath"] as const) {
            const order = typeValues(
                common.valueBindingTypes({ category, scope: { repeat: true, componentDef: true } })
            );
            expect(order).not.toContain("item");
            expect(order).not.toContain("index");
            expect(order).not.toContain("prop");
        }
    });
});

describe("P113: applyValueBinding serialisation", () => {
    it("string literal → { kind:'literal', value:<string> }", () => {
        expect(common.applyValueBinding("str", "Hello")).toEqual({ kind: "literal", value: "Hello" });
    });

    it("number literal → typed number value", () => {
        expect(common.applyValueBinding("num", "42")).toEqual({ kind: "literal", value: 42 });
    });

    it("boolean literal → typed boolean value", () => {
        expect(common.applyValueBinding("bool", "false")).toEqual({ kind: "literal", value: false });
        expect(common.applyValueBinding("bool", "true")).toEqual({ kind: "literal", value: true });
    });

    it("json literal → parsed JSON value", () => {
        expect(common.applyValueBinding("json", '{"a":1}')).toEqual({ kind: "literal", value: { a: 1 } });
    });

    it("timestamp literal → epoch-ms number value", () => {
        const result = common.applyValueBinding("date", "1700000000000");
        expect(result.kind).toBe("literal");
        expect(result.value).toBe(1700000000000);
    });

    it("reactive → { kind:'reactive', value:<source> } (value, not path)", () => {
        expect(common.applyValueBinding("reactive", "`Kunde ${routeParam.id}`")).toEqual({
            kind: "reactive",
            value: "`Kunde ${routeParam.id}`"
        });
    });

    it("jsonata → { kind:'jsonata', path:<expression> } (message-driven)", () => {
        expect(common.applyValueBinding("jsonata", "payload.user.name")).toEqual({
            kind: "jsonata",
            path: "payload.user.name"
        });
    });

    it("dynamic kinds (store/query/routeParam/msg/flow/global/env) → { kind, path }", () => {
        for (const kind of ["store", "query", "routeParam", "msg", "flow", "global", "env"]) {
            expect(common.applyValueBinding(kind, "x")).toEqual({ kind, path: "x" });
        }
    });

    it("scope-local item → { kind:'item', path:<field path> } (P165)", () => {
        expect(common.applyValueBinding("item", "name")).toEqual({ kind: "item", path: "name" });
        expect(common.applyValueBinding("item", "address.city")).toEqual({ kind: "item", path: "address.city" });
        // P184: the whole element (empty path) serialises WITHOUT a `path` key —
        // an empty string is no longer persisted (it is the legitimate
        // "whole element" case, not a malformed path the schema would reject).
        expect(common.applyValueBinding("item", "")).toEqual({ kind: "item" });
    });

    it("scope-local index → { kind:'index' } (path-free) (P184)", () => {
        // P184: `index` is always path-free — an empty value serialises with no
        // `path` key at all (previously `path:''`, which the schema rejected).
        expect(common.applyValueBinding("index", "")).toEqual({ kind: "index" });
    });

    it("scope-local prop → empty path omitted, dotted path kept (P184)", () => {
        // The whole-`prop` value (empty path) drops the key, exactly like `item`;
        // a real dotted field path is preserved.
        expect(common.applyValueBinding("prop", "")).toEqual({ kind: "prop" });
        expect(common.applyValueBinding("prop", "title")).toEqual({ kind: "prop", path: "title" });
    });
});

describe("P113: readValueBinding round-trips applyValueBinding", () => {
    it("string literal", () => {
        const stored = common.applyValueBinding("str", "Hello");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "str", value: "Hello" });
    });

    it("number literal restores the `num` sub-type", () => {
        const stored = common.applyValueBinding("num", "42");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "num", value: "42" });
    });

    it("boolean literal restores the `bool` sub-type", () => {
        const stored = common.applyValueBinding("bool", "false");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "bool", value: "false" });
    });

    it("json literal restores the `json` sub-type", () => {
        const stored = common.applyValueBinding("json", '{"a":1}');
        const read = common.readValueBinding(stored, "");
        expect(read.type).toBe("json");
        expect(JSON.parse(read.value)).toEqual({ a: 1 });
    });

    it("reactive restores source from `value`", () => {
        const stored = common.applyValueBinding("reactive", "routeParam.id");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "reactive", value: "routeParam.id" });
    });

    it("jsonata restores expression from `path`", () => {
        const stored = common.applyValueBinding("jsonata", "payload.x");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "jsonata", value: "payload.x" });
    });

    it("store restores id from `path`", () => {
        const stored = common.applyValueBinding("store", "store123");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "store", value: "store123" });
    });

    it("legacy state binding reads back as `state` (renderer still supports it)", () => {
        expect(common.readValueBinding({ kind: "state", path: "greeting" }, "")).toEqual({
            type: "state",
            value: "greeting"
        });
    });

    it("scope-local item round-trips field path through `path` (P165)", () => {
        const stored = common.applyValueBinding("item", "name");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "item", value: "name" });
    });

    it("scope-local index round-trips as path-free (P165)", () => {
        const stored = common.applyValueBinding("index", "");
        expect(common.readValueBinding(stored, "")).toEqual({ type: "index", value: "" });
    });
});
