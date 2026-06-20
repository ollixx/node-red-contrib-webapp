import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P196 (ADR 0023 §3, corrected 2026-06-20) — named repeat scopes, EDITOR layer.
 * The P193 per-alias TYPE explosion is REMOVED: the value typedInput now offers
 * exactly `item` + `index` (innermost) regardless of how many named enclosing
 * repeats exist. An OUTER repeat is addressed via a guided SCOPE PICKER beside the
 * path field whose options are 'innermost' + the enclosing aliases
 * (`collectEnclosingRepeatAliases`), setting `binding.scope` via the 4th
 * `applyValueBinding` arg. `readValueBinding` surfaces the alias as a separate
 * `scope` field that pre-selects the picker. The schema `scope` field + renderer
 * named-frame resolution from P193 are unchanged (covered by their own tests).
 */

interface TypedInputType {
    value: string;
    label?: string;
}

interface ContainerRef {
    id: string;
    mount: string;
    type?: string;
    itemName?: string;
}

interface References {
    containers: ContainerRef[];
}

interface EditorCommon {
    valueBindingTypes: (options?: {
        category?: string;
        scope?: { repeat?: boolean; componentDef?: boolean; repeatAliases?: string[] };
        currentKind?: string;
    }) => Array<TypedInputType | string>;
    readValueBinding: (binding: unknown, fallbackLiteral?: string) => { type: string; value: string; scope?: string };
    applyValueBinding: (type: string, value: string, subPath?: unknown, scope?: string) => { kind: string; scope?: string; path?: string };
    collectEnclosingRepeatAliases: (mount: string, references: References) => string[];
    isValueBindingValueValid: (type: string, value: string) => boolean;
    valueBindingScopeOptions: (aliases: string[]) => Array<{ value: string; label: string }>;
}

let common: EditorCommon;
const nodeTypes: Record<string, { type: string; itemName?: string }> = {};

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
    sandbox.RED = {
        nodes: {
            node: (id: string) => (nodeTypes[id] ? nodeTypes[id] : null)
        }
    };
    createContext(sandbox);
    runInContext(source, sandbox);
    common = sandbox.WebappEditorCommon as EditorCommon;
});

describe("P193: collectEnclosingRepeatAliases", () => {
    it("gathers the alias of a direct enclosing named repeat", () => {
        nodeTypes.rep = { type: "ui-repeat", itemName: "customer" };
        const refs: References = { containers: [{ id: "rep", mount: "route:/x/content", type: "ui-repeat", itemName: "customer" }] };
        expect(common.collectEnclosingRepeatAliases("container:rep/content", refs)).toEqual(["customer"]);
    });

    it("gathers nested aliases nearest-first (inner before outer)", () => {
        nodeTypes.outer = { type: "ui-repeat", itemName: "customer" };
        nodeTypes.inner = { type: "ui-repeat", itemName: "order" };
        const refs: References = {
            containers: [
                { id: "outer", mount: "route:/x/content", type: "ui-repeat", itemName: "customer" },
                { id: "inner", mount: "container:outer/content", type: "ui-repeat", itemName: "order" }
            ]
        };
        expect(common.collectEnclosingRepeatAliases("container:inner/content", refs)).toEqual(["order", "customer"]);
    });

    it("skips an UNNAMED enclosing repeat (no alias contributed)", () => {
        nodeTypes.named = { type: "ui-repeat", itemName: "customer" };
        nodeTypes.bare = { type: "ui-repeat", itemName: "" };
        const refs: References = {
            containers: [
                { id: "named", mount: "route:/x/content", type: "ui-repeat", itemName: "customer" },
                { id: "bare", mount: "container:named/content", type: "ui-repeat", itemName: "" }
            ]
        };
        // bare contributes nothing; the outer named one is still reachable.
        expect(common.collectEnclosingRepeatAliases("container:bare/content", refs)).toEqual(["customer"]);
    });

    it("de-duplicates a repeated alias (inner shadows, listed once)", () => {
        nodeTypes.o = { type: "ui-repeat", itemName: "row" };
        nodeTypes.i = { type: "ui-repeat", itemName: "row" };
        const refs: References = {
            containers: [
                { id: "o", mount: "route:/x/content", type: "ui-repeat", itemName: "row" },
                { id: "i", mount: "container:o/content", type: "ui-repeat", itemName: "row" }
            ]
        };
        expect(common.collectEnclosingRepeatAliases("container:i/content", refs)).toEqual(["row"]);
    });

    it("is empty outside any repeat", () => {
        expect(common.collectEnclosingRepeatAliases("route:/x/content", { containers: [] })).toEqual([]);
    });
});

describe("P196 (ADR 0023 §3): valueBindingTypes has NO per-alias type explosion", () => {
    // The correction to P193: the Repeat entries are EXACTLY `item` + `index`
    // (innermost) regardless of how many named enclosing repeats exist. The alias
    // surface moved to the guided SCOPE PICKER + the reactive scope() accessor.
    it("offers exactly Item (Repeat) + Index (Repeat) — no Item (<alias>) types", () => {
        const types = common.valueBindingTypes({
            category: "value",
            scope: { repeat: true, repeatAliases: ["customer", "order"] }
        });
        const values = typeValues(types);
        // The generic innermost item/index are present…
        expect(values).toContain("item");
        expect(values).toContain("index");
        // …and NO scope-qualified `item:<alias>` / `index:<alias>` types exist.
        expect(values.some((v) => /^(item|index):/.test(v))).toBe(false);
        // Exactly ONE item and ONE index entry, however many aliases there are.
        expect(values.filter((v) => v === "item")).toHaveLength(1);
        expect(values.filter((v) => v === "index")).toHaveLength(1);
    });

    it("a currently-selected alias type no longer re-adds a per-alias type", () => {
        const values = typeValues(common.valueBindingTypes({
            category: "value",
            scope: { repeat: true, repeatAliases: ["customer"] },
            currentKind: "item:customer"
        }));
        expect(values.some((v) => v.indexOf(":") >= 0)).toBe(false);
    });
});

describe("P196: the guided scope-picker option set", () => {
    // The options are 'innermost' (default, value='') + ONLY the real enclosing
    // named repeats (collectEnclosingRepeatAliases). By construction a non-
    // enclosing scope can never be offered.
    it("is 'innermost' + the enclosing aliases (nearest-first)", () => {
        expect(common.valueBindingScopeOptions(["order", "customer"])).toEqual([
            { value: "", label: "innermost (default)" },
            { value: "order", label: "order" },
            { value: "customer", label: "customer" }
        ]);
    });

    it("is just 'innermost' when there is no enclosing named repeat", () => {
        expect(common.valueBindingScopeOptions([])).toEqual([
            { value: "", label: "innermost (default)" }
        ]);
    });

    it("derives the options from the REAL enclosing repeats only", () => {
        nodeTypes.outer = { type: "ui-repeat", itemName: "customer" };
        nodeTypes.inner = { type: "ui-repeat", itemName: "order" };
        const refs: References = {
            containers: [
                { id: "outer", mount: "route:/x/content", type: "ui-repeat", itemName: "customer" },
                { id: "inner", mount: "container:outer/content", type: "ui-repeat", itemName: "order" }
            ]
        };
        const aliases = common.collectEnclosingRepeatAliases("container:inner/content", refs);
        const opts = common.valueBindingScopeOptions(aliases);
        expect(opts.map((o) => o.value)).toEqual(["", "order", "customer"]);
    });
});

describe("P196: apply / read round-trip via the scope (4th arg), not a type", () => {
    // The scope rides as the 4th `applyValueBinding` arg (set by the picker); the
    // type stays the bare `item`/`index`. readValueBinding surfaces the alias as a
    // separate `scope` field that pre-selects the picker.
    it("applyValueBinding('item','name', _, 'customer') → scoped item binding", () => {
        expect(common.applyValueBinding("item", "name", undefined, "customer"))
            .toEqual({ kind: "item", scope: "customer", path: "name" });
    });

    it("applyValueBinding('item','', _, 'customer') → whole-element scoped binding (no path)", () => {
        expect(common.applyValueBinding("item", "", undefined, "customer"))
            .toEqual({ kind: "item", scope: "customer" });
    });

    it("applyValueBinding('index','', _, 'customer') → scoped index (path-free)", () => {
        expect(common.applyValueBinding("index", "", undefined, "customer"))
            .toEqual({ kind: "index", scope: "customer" });
    });

    it("an empty/innermost scope leaves the binding UNSCOPED", () => {
        expect(common.applyValueBinding("item", "name", undefined, ""))
            .toEqual({ kind: "item", path: "name" });
    });

    it("readValueBinding restores a scoped item to {type:item, value:path, scope}", () => {
        expect(common.readValueBinding({ kind: "item", scope: "customer", path: "address.city" }, "")).toEqual({
            type: "item",
            value: "address.city",
            scope: "customer"
        });
    });

    it("readValueBinding restores a scoped index to {type:index, value:'', scope}", () => {
        expect(common.readValueBinding({ kind: "index", scope: "customer" }, "")).toEqual({
            type: "index",
            value: "",
            scope: "customer"
        });
    });

    it("a full apply → read round-trip preserves the alias and path (picker='customer', path='name')", () => {
        const binding = common.applyValueBinding("item", "name", undefined, "customer");
        expect(common.readValueBinding(binding, "")).toEqual({ type: "item", value: "name", scope: "customer" });
    });

    it("an UNSCOPED item still round-trips to the bare 'item' type with no scope", () => {
        const read = common.readValueBinding({ kind: "item", path: "name" }, "");
        expect(read).toEqual({ type: "item", value: "name" });
        expect((read as { scope?: string }).scope).toBeUndefined();
    });
});
