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
        category?: "value" | "boolean" | "url";
        literalLabel?: string;
        includeAsset?: boolean;
        appId?: string;
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

describe("P113: canonical value-binding type set", () => {
    it("value category (default) offers the 14 canonical types in order, then the scope-local repeat/component kinds", () => {
        const order = typeValues(common.valueBindingTypes());
        expect(order).toEqual([
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
            "env",
            // P165 (ADR 0017): scope-local item/index appended at the end so the
            // established ordering of the global kinds is unchanged.
            "item",
            "index",
            // P179 (ADR 0020): scope-local prop (component instance) appended after.
            "prop"
        ]);
    });

    it("the scope-local item/index/prop kinds sit ONLY at the tail of the value set (P165/P179)", () => {
        const order = typeValues(common.valueBindingTypes());
        // item/index/prop are present, last, and in that order.
        expect(order.slice(-3)).toEqual(["item", "index", "prop"]);
        expect(order.indexOf("item")).toBe(order.length - 3);
        expect(order.indexOf("index")).toBe(order.length - 2);
        expect(order.indexOf("prop")).toBe(order.length - 1);
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
        // The whole element (empty path) serialises with an empty path.
        expect(common.applyValueBinding("item", "")).toEqual({ kind: "item", path: "" });
    });

    it("scope-local index → { kind:'index', path:'' } (path-free) (P165)", () => {
        expect(common.applyValueBinding("index", "")).toEqual({ kind: "index", path: "" });
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
