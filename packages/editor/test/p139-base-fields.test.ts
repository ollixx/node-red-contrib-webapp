import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P139 (ADR 0015) — unit coverage for the common base-field applicability/hint
 * resolver behind `installBaseFields()`.
 *
 * The resolver is the pure, node-local capability declaration: a node passes
 * `{ visible, disabled, color, size, variant, hints }` and gets back, per base
 * field, whether it is applicable and (when N/A) the hint to show. The N/A
 * presentation (row disabled + hint text/tooltip) keys off exactly this output,
 * so pinning it here pins the editor contract.
 *
 * `resources/lib/editor-common.js` is a browser IIFE; the resolver is pure (no
 * jQuery / RED), so we load the file in a vm and assert on the export directly
 * (same pattern as p113-value-binding-types.test.ts).
 */

interface BaseFieldState {
    applicable: boolean;
    hint: string;
}

interface BaseFieldApplicability {
    visible: BaseFieldState;
    disabled: BaseFieldState;
    color: BaseFieldState;
    size: BaseFieldState;
}

interface EditorCommon {
    resolveBaseFieldApplicability: (config?: {
        visible?: boolean;
        disabled?: boolean;
        color?: boolean;
        size?: boolean;
        variant?: boolean;
        hints?: Record<string, string>;
    }) => BaseFieldApplicability;
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

describe("P139: resolveBaseFieldApplicability — applicability", () => {
    it("covers exactly the four ADR 0015 base fields", () => {
        const result = common.resolveBaseFieldApplicability({});
        expect(Object.keys(result).sort()).toEqual(["color", "disabled", "size", "visible"]);
    });

    it("defaults every base field to applicable (ADR 0015: every node offers the set)", () => {
        const result = common.resolveBaseFieldApplicability();
        for (const field of ["visible", "disabled", "color", "size"] as const) {
            expect(result[field].applicable, field).toBe(true);
            expect(result[field].hint, field).toBe("");
        }
    });

    it("a field declared false is N/A", () => {
        const result = common.resolveBaseFieldApplicability({ disabled: false, size: false });
        expect(result.disabled.applicable).toBe(false);
        expect(result.size.applicable).toBe(false);
        expect(result.visible.applicable).toBe(true);
        expect(result.color.applicable).toBe(true);
    });

    it("variant:true forces color to N/A even when color is declared true (mutual exclusion, ADR 0015 §1)", () => {
        const result = common.resolveBaseFieldApplicability({ color: true, variant: true });
        expect(result.color.applicable).toBe(false);
        // The other fields are untouched by the variant rule.
        expect(result.visible.applicable).toBe(true);
        expect(result.disabled.applicable).toBe(true);
        expect(result.size.applicable).toBe(true);
    });
});

describe("P139: resolveBaseFieldApplicability — hints", () => {
    it("an applicable field carries no hint", () => {
        const result = common.resolveBaseFieldApplicability({ visible: true });
        expect(result.visible.hint).toBe("");
    });

    it("an N/A field falls back to its built-in default hint", () => {
        const result = common.resolveBaseFieldApplicability({ disabled: false });
        expect(result.disabled.hint.length).toBeGreaterThan(0);
    });

    it("variant→color N/A uses the semantic-variant default hint", () => {
        const result = common.resolveBaseFieldApplicability({ variant: true });
        expect(result.color.hint).toContain("Variant");
    });

    it("a config hint overrides the default hint for an N/A field", () => {
        const result = common.resolveBaseFieldApplicability({
            disabled: false,
            size: false,
            hints: {
                disabled: "Ein Trenner hat keinen interaktiven Zustand.",
                size: "Ein Trenner hat keine Größen-Stufen."
            }
        });
        expect(result.disabled.hint).toBe("Ein Trenner hat keinen interaktiven Zustand.");
        expect(result.size.hint).toBe("Ein Trenner hat keine Größen-Stufen.");
    });

    it("a config hint also overrides the variant→color hint", () => {
        const result = common.resolveBaseFieldApplicability({
            variant: true,
            hints: { color: "Farbe kommt aus der Variant-Auswahl." }
        });
        expect(result.color.hint).toBe("Farbe kommt aus der Variant-Auswahl.");
    });

    it("a hint for an applicable field is ignored (no hint shown)", () => {
        const result = common.resolveBaseFieldApplicability({
            color: true,
            hints: { color: "sollte nie erscheinen" }
        });
        expect(result.color.applicable).toBe(true);
        expect(result.color.hint).toBe("");
    });
});
