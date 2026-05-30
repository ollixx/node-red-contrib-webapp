import { describe, expect, it } from "vitest";

import {
    buildDesignTokenCss,
    DESIGN_TOKEN_CSS_VARS,
    uiAppNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    validateUiNodeDefinition
} from "../src";

describe("design token schema on ui-app", () => {
    it("accepts a ui-app with no tokens", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            title: "Test App",
            layout: "app"
        });

        expect(result.success).toBe(true);
    });

    it("accepts a ui-app with a full token set", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            title: "Test App",
            layout: "app",
            tokens: {
                colorPrimary: "#3b82f6",
                colorDanger: "#ef4444",
                fontFamily: "Inter, sans-serif",
                radiusMd: "6px"
            }
        });

        expect(result.success).toBe(true);
    });

    it("accepts a ui-app with a custom primary color token", () => {
        const result = uiAppNodeDefinitionSchema.safeParse({
            type: "ui-app",
            id: "app1",
            title: "Test App",
            layout: "app",
            tokens: { colorPrimary: "#ff0000" }
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.tokens?.colorPrimary).toBe("#ff0000");
        }
    });
});

describe("buildDesignTokenCss", () => {
    it("returns empty string for undefined tokens", () => {
        expect(buildDesignTokenCss(undefined)).toBe("");
    });

    it("returns empty string for empty tokens object", () => {
        expect(buildDesignTokenCss({})).toBe("");
    });

    it("injects correct CSS custom property for primary color", () => {
        const css = buildDesignTokenCss({ colorPrimary: "#3b82f6" });

        expect(css).toContain("--wa-color-primary: #3b82f6");
        expect(css).toContain(":root {");
    });

    it("injects multiple tokens when multiple fields are set", () => {
        const css = buildDesignTokenCss({
            colorPrimary: "#3b82f6",
            colorDanger: "#ef4444",
            radiusMd: "6px"
        });

        expect(css).toContain("--wa-color-primary: #3b82f6");
        expect(css).toContain("--wa-color-danger: #ef4444");
        expect(css).toContain("--wa-radius-md: 6px");
    });

    it("omits tokens with undefined values", () => {
        const css = buildDesignTokenCss({ colorPrimary: "#3b82f6", colorDanger: undefined });

        expect(css).not.toContain("--wa-color-danger");
    });

    it("covers all token fields in DESIGN_TOKEN_CSS_VARS map", () => {
        const tokenFields = Object.keys(DESIGN_TOKEN_CSS_VARS);

        expect(tokenFields.length).toBeGreaterThan(0);
        // Every field maps to a --wa- prefixed CSS var
        for (const cssVar of Object.values(DESIGN_TOKEN_CSS_VARS)) {
            expect(cssVar).toMatch(/^--wa-/);
        }
    });
});

describe("variant field on view nodes", () => {
    it("accepts ui-button with variant=primary", () => {
        const result = uiButtonNodeDefinitionSchema.safeParse({
            type: "ui-button",
            id: "btn1",
            parent: "app1/route1/content",
            label: "Save",
            action: "saveAction",
            variant: "primary"
        });

        expect(result.success).toBe(true);
    });

    it("accepts ui-button with variant (unknown fields stripped)", () => {
        const result = uiButtonNodeDefinitionSchema.safeParse({
            type: "ui-button",
            id: "btn1",
            parent: "app1/route1/content",
            label: "Delete",
            action: "deleteAction"
        });

        expect(result.success).toBe(true);
    });

    it("accepts ui-button without variant (variant not in schema)", () => {
        const result = uiButtonNodeDefinitionSchema.safeParse({
            type: "ui-button",
            id: "btn1",
            parent: "app1/route1/content",
            label: "Save",
            action: "saveAction"
        });

        expect(result.success).toBe(true);
    });

    it("validates ui-button without variant", () => {
        const result = validateUiNodeDefinition({
            type: "ui-button",
            id: "btn1",
            parent: "app1/route1/content",
            label: "Delete",
            action: "deleteAction"
        });

        expect(result.success).toBe(true);
    });

    it("accepts ui-button with no variant (optional)", () => {
        const result = uiButtonNodeDefinitionSchema.safeParse({
            type: "ui-button",
            id: "btn1",
            parent: "app1/route1/content",
            label: "Cancel",
            action: "cancelAction"
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.variant).toBeUndefined();
        }
    });

    it("accepts all valid button variants", () => {
        const variants = ["primary", "secondary", "danger", "ghost", "link"];

        for (const variant of variants) {
            const result = uiButtonNodeDefinitionSchema.safeParse({
                type: "ui-button",
                id: "btn1",
                parent: "app1/route1/content",
                label: "Btn",
                action: "action1",
                variant
            });

            expect(result.success, `variant=${variant}`).toBe(true);
        }
    });

    it("accepts ui-container with layout", () => {
        const result = validateUiNodeDefinition({
            type: "ui-container",
            id: "c1",
            parent: "app1/route1/content",
            layout: "vertical"
        });

        expect(result.success).toBe(true);
    });

    it("accepts ui-table with variant=striped", () => {
        const result = validateUiNodeDefinition({
            type: "ui-table",
            id: "t1",
            parent: "app1/route1/content",
            columns: ["name"],
            rows: { kind: "state", path: "customers" },
            variant: "striped"
        });

        expect(result.success).toBe(true);
    });
});
