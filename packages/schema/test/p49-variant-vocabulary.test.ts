import { describe, expect, it } from "vitest";

import {
    ALERT_VARIANTS,
    BADGE_VARIANTS,
    BUTTON_VARIANTS,
    COMPONENT_VARIANT_DEFAULT,
    COMPONENT_VARIANT_VOCABULARY,
    CONTAINER_VARIANTS,
    INPUT_VARIANTS,
    SEVERITY_VARIANTS,
    TEXT_STYLES,
    TEXT_COLOR_VARIANTS,
    uiAlertNodeDefinitionSchema,
    uiBadgeNodeDefinitionSchema,
    uiButtonNodeDefinitionSchema,
    uiContainerNodeDefinitionSchema,
    uiInputNodeDefinitionSchema,
    uiTextNodeDefinitionSchema
} from "../src";

/**
 * P49 — variant vocabulary is a single, portable source of truth in the schema.
 *
 * Asserts each exported vocabulary is non-empty and contains its documented
 * core values, and that the per-node lookup + defaults are internally
 * consistent. The serializer side is pinned in the runtime package
 * (p49-variant-serializer.test.ts).
 */

describe("P49: variant vocabularies", () => {
    it("each vocabulary is non-empty", () => {
        for (const vocab of [
            BUTTON_VARIANTS,
            TEXT_STYLES,
            TEXT_COLOR_VARIANTS,
            CONTAINER_VARIANTS,
            INPUT_VARIANTS,
            BADGE_VARIANTS,
            ALERT_VARIANTS,
            SEVERITY_VARIANTS
        ]) {
            expect(vocab.length).toBeGreaterThan(0);
        }
    });

    it("contains the documented core values", () => {
        // button — primary/danger are the assertions existing E2E pins rely on.
        expect(BUTTON_VARIANTS).toContain("primary");
        expect(BUTTON_VARIANTS).toContain("secondary");
        expect(BUTTON_VARIANTS).toContain("danger");
        expect(BUTTON_VARIANTS).toContain("ghost");
        expect(BUTTON_VARIANTS).toContain("link");

        // text style — the heading hierarchy + body roles (P111: `muted` is now
        // a colour, not a role, so it lives on TEXT_COLOR_VARIANTS).
        expect(TEXT_STYLES).toContain("heading-1");
        expect(TEXT_STYLES).toContain("heading-2");
        expect(TEXT_STYLES).toContain("body");
        expect(TEXT_STYLES).toContain("code");
        expect(TEXT_STYLES).not.toContain("muted");

        // text colour — the semantic palette (P111).
        expect(TEXT_COLOR_VARIANTS).toContain("default");
        expect(TEXT_COLOR_VARIANTS).toContain("muted");
        expect(TEXT_COLOR_VARIANTS).toContain("danger");

        // container — the surface roles.
        expect(CONTAINER_VARIANTS).toContain("card");
        expect(CONTAINER_VARIANTS).toContain("panel");
        expect(CONTAINER_VARIANTS).toContain("transparent");

        // input — the field styles.
        expect(INPUT_VARIANTS).toContain("default");
        expect(INPUT_VARIANTS).toContain("outlined");

        // severity — info is a deliberate alias of primary.
        expect(SEVERITY_VARIANTS).toContain("primary");
        expect(SEVERITY_VARIANTS).toContain("danger");
        expect(SEVERITY_VARIANTS).toContain("info");
    });

    it("the per-kind lookup resolves to the matching vocabulary", () => {
        expect(COMPONENT_VARIANT_VOCABULARY.button).toBe(BUTTON_VARIANTS);
        // P111: ui-text `variant` is the colour axis now.
        expect(COMPONENT_VARIANT_VOCABULARY.text).toBe(TEXT_COLOR_VARIANTS);
        expect(COMPONENT_VARIANT_VOCABULARY.container).toBe(CONTAINER_VARIANTS);
        expect(COMPONENT_VARIANT_VOCABULARY.input).toBe(INPUT_VARIANTS);
        expect(COMPONENT_VARIANT_VOCABULARY.badge).toBe(BADGE_VARIANTS);
        expect(COMPONENT_VARIANT_VOCABULARY.alert).toBe(ALERT_VARIANTS);
    });

    it("does NOT expose display-type nodes as variant-bearing", () => {
        // progress/skeleton/list/menu use displayType, not variant.
        for (const displayKind of ["progress", "skeleton", "list", "menu"]) {
            expect(COMPONENT_VARIANT_VOCABULARY[displayKind]).toBeUndefined();
        }
    });

    it("every kind with a vocabulary has a default drawn from that vocabulary", () => {
        for (const kind of Object.keys(COMPONENT_VARIANT_VOCABULARY)) {
            const def = COMPONENT_VARIANT_DEFAULT[kind];
            expect(def, `missing default for ${kind}`).toBeDefined();
            expect(COMPONENT_VARIANT_VOCABULARY[kind]).toContain(def);
        }
    });
});

describe("P49: node schemas constrain variant to the vocabulary", () => {
    const base = { mount: "app1.content" };

    it("ui-button accepts a vocabulary variant and rejects an unknown one", () => {
        expect(
            uiButtonNodeDefinitionSchema.safeParse({ ...base, type: "ui-button", id: "b", label: "Go", variant: "primary" }).success
        ).toBe(true);
        expect(
            uiButtonNodeDefinitionSchema.safeParse({ ...base, type: "ui-button", id: "b", label: "Go", variant: "bogus" }).success
        ).toBe(false);
    });

    it("ui-text accepts a style role + colour variant and rejects unknown ones", () => {
        // P111: `style` = typographic role, `variant` = semantic colour.
        expect(
            uiTextNodeDefinitionSchema.safeParse({ ...base, type: "ui-text", id: "t", value: { kind: "literal", value: "Hi" }, style: "heading-2", variant: "danger" }).success
        ).toBe(true);
        // A legacy role value is no longer valid in `variant` (it moved to `style`).
        expect(
            uiTextNodeDefinitionSchema.safeParse({ ...base, type: "ui-text", id: "t", value: { kind: "literal", value: "Hi" }, variant: "heading-2" }).success
        ).toBe(false);
        expect(
            uiTextNodeDefinitionSchema.safeParse({ ...base, type: "ui-text", id: "t", value: { kind: "literal", value: "Hi" }, style: "bogus" }).success
        ).toBe(false);
    });

    it("ui-container accepts a container variant", () => {
        expect(
            uiContainerNodeDefinitionSchema.safeParse({ ...base, type: "ui-container", id: "c", layout: "vertical", variant: "card" }).success
        ).toBe(true);
        expect(
            uiContainerNodeDefinitionSchema.safeParse({ ...base, type: "ui-container", id: "c", layout: "vertical", variant: "bogus" }).success
        ).toBe(false);
    });

    it("ui-input accepts an input variant", () => {
        expect(
            uiInputNodeDefinitionSchema.safeParse({ ...base, type: "ui-input", id: "i", label: "Name", value: { kind: "literal", value: "" }, variant: "outlined" }).success
        ).toBe(true);
    });
});

/**
 * P49b — variant / severity field on ui-badge / ui-alert uses exactly the
 * SEVERITY_VARIANTS set.
 *
 * Asserts that:
 *   1. Every value in SEVERITY_VARIANTS is accepted by both schemas.
 *   2. Legacy-only values removed from SEVERITY_VARIANTS ("error", "default") are rejected.
 *   3. A completely unknown value is rejected.
 *
 * P92 update: ui-badge now uses the field `variant` (renamed from `severity`).
 * ui-alert still uses `severity`. Tests for ui-badge updated accordingly.
 */
describe("P49b: ui-badge / ui-alert severity field uses SEVERITY_VARIANTS", () => {
    const base = { mount: "app1.content" };

    it("ui-badge accepts every SEVERITY_VARIANTS value (via `variant` field, P92)", () => {
        for (const sev of SEVERITY_VARIANTS) {
            const result = uiBadgeNodeDefinitionSchema.safeParse({
                ...base,
                type: "ui-badge",
                id: "b1",
                value: { kind: "literal", value: "42" },
                variant: sev
            });
            expect(result.success, `ui-badge should accept variant "${sev}"`).toBe(true);
        }
    });

    it("ui-badge rejects the legacy-only value 'error' in `variant`", () => {
        expect(
            uiBadgeNodeDefinitionSchema.safeParse({
                ...base,
                type: "ui-badge",
                id: "b1",
                value: { kind: "literal", value: "42" },
                variant: "error"
            }).success
        ).toBe(false);
    });

    it("ui-badge rejects the legacy-only value 'default' in `variant`", () => {
        expect(
            uiBadgeNodeDefinitionSchema.safeParse({
                ...base,
                type: "ui-badge",
                id: "b1",
                value: { kind: "literal", value: "42" },
                variant: "default"
            }).success
        ).toBe(false);
    });

    it("ui-badge rejects a completely unknown `variant` value", () => {
        expect(
            uiBadgeNodeDefinitionSchema.safeParse({
                ...base,
                type: "ui-badge",
                id: "b1",
                value: { kind: "literal", value: "42" },
                variant: "bogus"
            }).success
        ).toBe(false);
    });

    it("ui-alert accepts every SEVERITY_VARIANTS value", () => {
        for (const sev of SEVERITY_VARIANTS) {
            const result = uiAlertNodeDefinitionSchema.safeParse({
                ...base,
                type: "ui-alert",
                id: "a1",
                message: { kind: "literal", value: "Hello" },
                severity: sev
            });
            expect(result.success, `ui-alert should accept severity "${sev}"`).toBe(true);
        }
    });

    it("ui-alert rejects the legacy-only value 'error'", () => {
        expect(
            uiAlertNodeDefinitionSchema.safeParse({
                ...base,
                type: "ui-alert",
                id: "a1",
                message: { kind: "literal", value: "Hello" },
                severity: "error"
            }).success
        ).toBe(false);
    });

    it("ui-alert rejects a completely unknown severity", () => {
        expect(
            uiAlertNodeDefinitionSchema.safeParse({
                ...base,
                type: "ui-alert",
                id: "a1",
                message: { kind: "literal", value: "Hello" },
                severity: "bogus"
            }).success
        ).toBe(false);
    });
});
