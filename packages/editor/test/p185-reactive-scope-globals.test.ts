import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P185 (ADR 0017/0020) — unit coverage for the pure helper behind the reactive
 * editor's scope-local autocomplete: `reactiveScopeGlobals(ctx)` offers
 * `item`/`index` only inside a repeat and `prop` only inside a component
 * definition. Same vm-load pattern as P116 — the helper is pure (no jQuery/RED).
 */

interface ScopeGlobal {
    name: string;
    insert: string;
    detail: string;
    doc: string;
    example: string;
}

interface EditorCommon {
    reactiveScopeGlobals: (ctx: {
        inRepeat?: boolean;
        inComponentDef?: boolean;
    }) => ScopeGlobal[];
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

function names(ctx: { inRepeat?: boolean; inComponentDef?: boolean }): string[] {
    return common.reactiveScopeGlobals(ctx).map((g) => g.name);
}

describe("P185: reactive scope-local globals gating", () => {
    it("offers item + index inside a repeat", () => {
        expect(names({ inRepeat: true })).toEqual(["item", "index"]);
    });

    it("offers prop inside a component definition", () => {
        expect(names({ inComponentDef: true })).toEqual(["prop"]);
    });

    it("offers item/index AND prop when nested in both scopes", () => {
        expect(names({ inRepeat: true, inComponentDef: true })).toEqual(["item", "index", "prop"]);
    });

    it("offers nothing outside any scope-local container", () => {
        expect(names({})).toEqual([]);
        expect(names({ inRepeat: false, inComponentDef: false })).toEqual([]);
    });

    it("is robust to a missing/undefined context", () => {
        expect(common.reactiveScopeGlobals(undefined as unknown as { inRepeat?: boolean })).toEqual([]);
    });
});
