import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
    };
};

const { runtimeNodeRegistry } = webapp.__test__;

const baseMount = { mount: "route:/dashboard/content" };

type BadgeDef = {
    type: string;
    value: unknown;
    displayType: unknown;
    variant: unknown;
    pulsating: unknown;
};

function mapBadge(config: Record<string, unknown>): BadgeDef {
    return runtimeNodeRegistry["ui-badge"].mapConfig(config) as BadgeDef;
}

/**
 * P153 — ui-badge: `valuePath` → `value` canonical typedInput (ADR 0012).
 * Mirrors P137 (ui-progress). Asserts runtime mapper handles both migration
 * (legacy valuePath) and the new binding-object forms.
 */
describe("P153: ui-badge — value as typedInput (ADR 0012)", () => {
    // ── value: migration ────────────────────────────────────────────────────

    it("migrates legacy valuePath (plain string) → state binding for value", () => {
        const def = mapBadge({
            id: "b1",
            ...baseMount,
            valuePath: "user.count"
        });
        expect(def.value).toEqual({ kind: "state", path: "user.count" });
    });

    it("prefers stored value binding object over valuePath", () => {
        const def = mapBadge({
            id: "b1",
            ...baseMount,
            valuePath: "user.count",
            value: { kind: "store", path: "notifStore" }
        });
        expect(def.value).toEqual({ kind: "store", path: "notifStore" });
    });

    it("accepts literal string binding for value", () => {
        const def = mapBadge({
            id: "b1",
            ...baseMount,
            value: { kind: "literal", value: "42" }
        });
        expect(def.value).toEqual({ kind: "literal", value: "42" });
    });

    it("accepts literal number binding for value", () => {
        const def = mapBadge({
            id: "b1",
            ...baseMount,
            value: { kind: "literal", value: 7 }
        });
        expect(def.value).toEqual({ kind: "literal", value: 7 });
    });

    it("falls back to state binding from valuePath when value not present", () => {
        const def = mapBadge({
            id: "b1",
            ...baseMount,
            valuePath: "notifications.unread"
        });
        expect(def.value).toEqual({ kind: "state", path: "notifications.unread" });
    });

    // ── unchanged fields ─────────────────────────────────────────────────────

    it("passes displayType, variant, pulsating through unchanged", () => {
        const def = mapBadge({
            id: "b1",
            ...baseMount,
            value: { kind: "literal", value: "NEW" },
            displayType: "pill",
            variant: "primary",
            pulsating: true
        });
        expect(def.displayType).toBe("pill");
        expect(def.variant).toBe("primary");
        expect(def.pulsating).toBe(true);
    });
});
