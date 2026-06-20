import { describe, expect, it } from "vitest";

import {
    CONTAINER_VARIANTS,
    COMPONENT_VARIANT_DEFAULT,
    COMPONENT_VARIANT_VOCABULARY,
    uiRepeatNodeDefinitionSchema
} from "../src";

/**
 * P197 — ui-repeat is a full container after P191 (own content-slot layout), so it
 * also carries the semantic container `variant` (CONTAINER_VARIANTS) exactly like
 * ui-container. The schema field is OPTIONAL; the documented DEFAULT is
 * `transparent` (a repeat is chrome-less per ADR 0017 — no wasted card around the
 * clones). Migration: an existing ui-repeat with no `variant` still validates
 * (no required-field break) — the editor/mapConfig default supplies `transparent`.
 */
describe("P197: ui-repeat variant field (container conformance)", () => {
    const baseRepeat = {
        type: "ui-repeat" as const,
        id: "rep",
        mount: "route:/home/content",
        items: { kind: "literal" as const, value: [{ name: "Ada" }] }
    };

    it("accepts every CONTAINER_VARIANTS value on `variant`", () => {
        for (const variant of CONTAINER_VARIANTS) {
            const result = uiRepeatNodeDefinitionSchema.safeParse({ ...baseRepeat, variant });
            expect(result.success, `variant ${variant}`).toBe(true);
        }
    });

    it("migration: a ui-repeat with NO variant still validates (no required-field break)", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse(baseRepeat);
        expect(result.success).toBe(true);
        // Optional → an absent variant stays absent in the parsed object; the
        // documented default (transparent) is applied downstream (mapConfig/editor).
        if (result.success) {
            expect(result.data.variant).toBeUndefined();
        }
    });

    it("rejects a variant outside the CONTAINER_VARIANTS vocabulary", () => {
        const result = uiRepeatNodeDefinitionSchema.safeParse({ ...baseRepeat, variant: "totally-made-up" });
        expect(result.success).toBe(false);
    });

    it("the shared variant vocabulary keys `repeat` to CONTAINER_VARIANTS, default transparent", () => {
        // ui-repeat reuses ui-container's vocabulary but its OWN (chrome-less) default.
        expect(COMPONENT_VARIANT_VOCABULARY.repeat).toEqual(CONTAINER_VARIANTS);
        expect(COMPONENT_VARIANT_DEFAULT.repeat).toBe("transparent");
        // Default diverges from ui-container deliberately (card vs transparent).
        expect(COMPONENT_VARIANT_DEFAULT.container).toBe("card");
    });
});
