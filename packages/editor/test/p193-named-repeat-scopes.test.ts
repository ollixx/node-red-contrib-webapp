import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P193 (ADR 0023) — named repeat scopes, EDITOR layer. The value typedInput offers
 * each enclosing NAMED repeat alias as a by-name binding type (`item:<alias>` /
 * `index:<alias>`, labelled "Item (<alias>)" / "Index (<alias>)"), gated like P182.
 * The apply/read pair round-trips those types to a scope-qualified binding
 * (`{kind:"item"|"index", scope:"<alias>", path}`). `collectEnclosingRepeatAliases`
 * walks the container chain and gathers the aliases of enclosing ui-repeats.
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
    readValueBinding: (binding: unknown, fallbackLiteral?: string) => { type: string; value: string };
    applyValueBinding: (type: string, value: string) => { kind: string; scope?: string; path?: string };
    collectEnclosingRepeatAliases: (mount: string, references: References) => string[];
    isValueBindingValueValid: (type: string, value: string) => boolean;
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

describe("P193: valueBindingTypes offers the enclosing aliases (gated like P182)", () => {
    it("adds Item (<alias>) / Index (<alias>) per enclosing alias", () => {
        const types = common.valueBindingTypes({
            category: "value",
            scope: { repeat: true, repeatAliases: ["customer", "order"] }
        });
        const values = typeValues(types);
        expect(values).toContain("item:customer");
        expect(values).toContain("index:customer");
        expect(values).toContain("item:order");
        expect(values).toContain("index:order");
        // The generic innermost item/index are still present.
        expect(values).toContain("item");
        expect(values).toContain("index");
    });

    it("omits alias types when there are no enclosing named repeats", () => {
        const values = typeValues(common.valueBindingTypes({
            category: "value",
            scope: { repeat: false, repeatAliases: [] }
        }));
        expect(values.some((v) => v.indexOf(":") >= 0)).toBe(false);
    });

    it("re-includes a currently-selected alias type even when out of scope", () => {
        const values = typeValues(common.valueBindingTypes({
            category: "value",
            scope: { repeat: false, repeatAliases: [] },
            currentKind: "item:customer"
        }));
        expect(values).toContain("item:customer");
    });

    it("labels the alias type 'Item (<alias>)'", () => {
        const types = common.valueBindingTypes({
            category: "value",
            scope: { repeat: true, repeatAliases: ["customer"] }
        });
        const itemType = types.find((t) => typeof t !== "string" && t.value === "item:customer") as TypedInputType;
        expect(itemType.label).toBe("Item (customer)");
    });
});

describe("P193: apply / read round-trip for scoped item/index", () => {
    it("applyValueBinding('item:customer', 'name') → scoped item binding", () => {
        expect(common.applyValueBinding("item:customer", "name")).toEqual({ kind: "item", scope: "customer", path: "name" });
    });

    it("applyValueBinding('item:customer', '') → whole-element scoped binding (no path)", () => {
        expect(common.applyValueBinding("item:customer", "")).toEqual({ kind: "item", scope: "customer" });
    });

    it("applyValueBinding('index:customer', '') → scoped index (path-free)", () => {
        expect(common.applyValueBinding("index:customer", "")).toEqual({ kind: "index", scope: "customer" });
    });

    it("readValueBinding restores a scoped item to its named typedInput type", () => {
        expect(common.readValueBinding({ kind: "item", scope: "customer", path: "address.city" }, "")).toEqual({
            type: "item:customer",
            value: "address.city"
        });
    });

    it("readValueBinding restores a scoped index to index:<alias>", () => {
        expect(common.readValueBinding({ kind: "index", scope: "customer" }, "")).toEqual({
            type: "index:customer",
            value: ""
        });
    });

    it("a full apply → read round-trip preserves the alias and path", () => {
        const binding = common.applyValueBinding("item:order", "total");
        expect(common.readValueBinding(binding, "")).toEqual({ type: "item:order", value: "total" });
    });

    it("an UNSCOPED item still round-trips to the bare 'item' type (no regression)", () => {
        expect(common.readValueBinding({ kind: "item", path: "name" }, "")).toEqual({ type: "item", value: "name" });
    });
});

describe("P193: scoped types validate like their bare kind", () => {
    it("empty path on item:<alias> is valid (whole element)", () => {
        expect(common.isValueBindingValueValid("item:customer", "")).toBe(true);
    });

    it("a dotted path on item:<alias> is valid", () => {
        expect(common.isValueBindingValueValid("item:customer", "address.city")).toBe(true);
    });

    it("index:<alias> is always valid (path-free)", () => {
        expect(common.isValueBindingValueValid("index:customer", "")).toBe(true);
    });

    it("a malformed path on item:<alias> is invalid", () => {
        expect(common.isValueBindingValueValid("item:customer", ".bad")).toBe(false);
    });
});
