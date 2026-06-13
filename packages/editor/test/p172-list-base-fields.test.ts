import { describe, expect, it } from "vitest";

import { emitNodeDefinition } from "../src";

/**
 * P172 (ADR 0015) — ui-list: common base fields retrofitted.
 * visible (applicable), disabled (applicable), color (applicable, non-variant).
 * size N/A (density is controlled by displayType).
 *
 * The editor mapper passes binding objects through for visible/disabled/color
 * and omits them when absent/null (default = always visible / not disabled / no color).
 */
function mapList(config: Record<string, unknown>) {
    const result = emitNodeDefinition("ui-list", { id: "l1", mount: "route:/x/content", ...config } as never);
    if (!result.success) {
        throw new Error("ui-list emit failed: " + result.error);
    }
    return result.data as unknown as {
        type: string;
        items: unknown;
        visible?: unknown;
        disabled?: unknown;
        color?: unknown;
    };
}

describe("P172: ui-list editor mapper — base fields (visible / disabled / color)", () => {
    it("visible binding object passes through to the schema definition", () => {
        const binding = { kind: "state", path: "isListVisible" };
        const def = mapList({ items: [], visible: binding });
        expect(def.visible).toEqual(binding);
    });

    it("absent visible omits the field from the definition (always visible default)", () => {
        const def = mapList({ items: [] });
        expect(def.visible).toBeUndefined();
    });

    it("null visible is treated as absent (always visible)", () => {
        const def = mapList({ items: [], visible: null });
        expect(def.visible).toBeUndefined();
    });

    it("disabled binding object passes through to the schema definition", () => {
        const binding = { kind: "state", path: "isDisabled" };
        const def = mapList({ items: [], disabled: binding });
        expect(def.disabled).toEqual(binding);
    });

    it("absent disabled omits the field from the definition (not disabled default)", () => {
        const def = mapList({ items: [] });
        expect(def.disabled).toBeUndefined();
    });

    it("color binding object passes through to the schema definition", () => {
        const binding = { kind: "literal", value: "#ff0000" };
        const def = mapList({ items: [], color: binding });
        expect(def.color).toEqual(binding);
    });

    it("absent color omits the field from the definition (no color default)", () => {
        const def = mapList({ items: [] });
        expect(def.color).toBeUndefined();
    });

    it("store binding for color passes through unchanged", () => {
        const binding = { kind: "store", path: "theme", subPath: { kind: "literal", value: "listColor" } };
        const def = mapList({ items: [], color: binding });
        expect(def.color).toEqual(binding);
    });

    it("all three applicable base fields can be set simultaneously", () => {
        const visibleBind = { kind: "state", path: "show" };
        const disabledBind = { kind: "state", path: "locked" };
        const colorBind = { kind: "literal", value: "#123456" };
        const def = mapList({ items: [], visible: visibleBind, disabled: disabledBind, color: colorBind });
        expect(def.visible).toEqual(visibleBind);
        expect(def.disabled).toEqual(disabledBind);
        expect(def.color).toEqual(colorBind);
    });
});
