import { describe, expect, it } from "vitest";

import { TEXT_DISPLAY_MODES, uiTextNodeDefinitionSchema } from "../src/index";

/**
 * P221 (ADR 0035) — ui-text gains a `display` presentation mode
 * (`text` | `formField`) and an optional `label` for the form-field row.
 */

const base = {
    type: "ui-text" as const,
    id: "t1",
    mount: "route:/x/content",
    value: { kind: "literal" as const, value: "hello" }
};

describe("P221: ui-text display-mode schema", () => {
    it("exposes exactly text | formField as the display vocabulary", () => {
        expect([...TEXT_DISPLAY_MODES]).toEqual(["text", "formField"]);
    });

    it("display is absent by default and consumers treat absence as 'text' (existing flows unchanged)", () => {
        const parsed = uiTextNodeDefinitionSchema.parse(base);
        expect(parsed.display).toBeUndefined();
    });

    it("accepts an explicit display: 'text'", () => {
        const parsed = uiTextNodeDefinitionSchema.parse({ ...base, display: "text" });
        expect(parsed.display).toBe("text");
    });

    it("accepts display: 'formField' with a label", () => {
        const parsed = uiTextNodeDefinitionSchema.parse({ ...base, display: "formField", label: "Entity ID" });
        expect(parsed.display).toBe("formField");
        expect(parsed.label).toBe("Entity ID");
    });

    it("rejects an unknown display value", () => {
        const result = uiTextNodeDefinitionSchema.safeParse({ ...base, display: "inline" });
        expect(result.success).toBe(false);
    });

    it("label is optional (only relevant in form-field mode)", () => {
        const parsed = uiTextNodeDefinitionSchema.parse({ ...base, display: "formField" });
        expect(parsed.label).toBeUndefined();
    });
});
