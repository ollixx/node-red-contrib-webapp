import { describe, expect, it } from "vitest";

import {
    DYNAMIC_STATE_FIELDS,
    DYNAMIC_STATE_FIELD_NEUTRAL,
    DYNAMIC_STATE_BOUND_KINDS,
    isDynamicStateField
} from "../src/index";

/**
 * P224 (ADR 0037) — the dynamic-state field class.
 *
 * An authoritative, extensible list of the bindable fields that represent a
 * runtime state of a component (`visible`, `disabled`) vs static presentational
 * fields (color/size/variant), which are deliberately excluded.
 */
describe("P224: dynamic-state field class", () => {
    it("lists visible and disabled as the dynamic-state fields", () => {
        expect([...DYNAMIC_STATE_FIELDS]).toEqual(["visible", "disabled"]);
    });

    it("neutral value is true for visible, false for disabled", () => {
        expect(DYNAMIC_STATE_FIELD_NEUTRAL.visible).toBe(true);
        expect(DYNAMIC_STATE_FIELD_NEUTRAL.disabled).toBe(false);
    });

    it("isDynamicStateField recognises the members and rejects static fields", () => {
        expect(isDynamicStateField("visible")).toBe(true);
        expect(isDynamicStateField("disabled")).toBe(true);
        // static presentational fields are NOT dynamic-state fields
        expect(isDynamicStateField("color")).toBe(false);
        expect(isDynamicStateField("size")).toBe(false);
        expect(isDynamicStateField("variant")).toBe(false);
        expect(isDynamicStateField("value")).toBe(false);
    });

    it("the bound-kind set is the reactive/store sources (not literal/msg)", () => {
        // BOUND = the value is reactive from that source (write goes through to it).
        expect([...DYNAMIC_STATE_BOUND_KINDS].sort()).toEqual(
            ["query", "reactive", "routeParam", "state", "store"].sort()
        );
        // literal / msg / jsonata are UNBOUND (slot-backed) — deliberately absent.
        expect(DYNAMIC_STATE_BOUND_KINDS as readonly string[]).not.toContain("literal");
        expect(DYNAMIC_STATE_BOUND_KINDS as readonly string[]).not.toContain("msg");
        expect(DYNAMIC_STATE_BOUND_KINDS as readonly string[]).not.toContain("jsonata");
    });
});
