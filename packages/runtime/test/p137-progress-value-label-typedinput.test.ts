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

type ProgressDef = {
    type: string;
    value: unknown;
    label: unknown;
    showValue: unknown;
    displayType: unknown;
};

function mapProgress(config: Record<string, unknown>): ProgressDef {
    return runtimeNodeRegistry["ui-progress"].mapConfig(config) as ProgressDef;
}

/**
 * P137 — ui-progress: `valuePath`→`value` canonical typedInput + `label` as
 * value-binding typedInput. Asserts runtime mapper handles both migration and
 * the new binding-object forms.
 */
describe("P137: ui-progress — value + label as typedInput (ADR 0012)", () => {
    // ── value: migration ────────────────────────────────────────────────────

    it("migrates legacy valuePath (plain string) → state binding for value", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount,
            valuePath: "upload.percent"
        });
        expect(def.value).toEqual({ kind: "state", path: "upload.percent" });
    });

    it("prefers stored value binding object over valuePath", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount,
            valuePath: "upload.percent",
            value: { kind: "store", path: "progressStore" }
        });
        expect(def.value).toEqual({ kind: "store", path: "progressStore" });
    });

    it("accepts literal number binding for value", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount,
            value: { kind: "literal", value: 42 }
        });
        expect(def.value).toEqual({ kind: "literal", value: 42 });
    });

    it("leaves value undefined when neither value nor valuePath is set (indeterminate)", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount
        });
        expect(def.value).toBeUndefined();
    });

    // ── label: typedInput binding ────────────────────────────────────────────

    it("accepts label as a literal string binding object", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount,
            label: { kind: "literal", value: "Uploading…" }
        });
        expect(def.label).toEqual({ kind: "literal", value: "Uploading…" });
    });

    it("accepts label as a store binding object", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount,
            label: { kind: "store", path: "progressStore" }
        });
        expect(def.label).toEqual({ kind: "store", path: "progressStore" });
    });

    it("passes through legacy plain-string label (back-compat)", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount,
            label: "Loading…"
        });
        // Plain string: getBinding returns undefined, falls back to the raw string.
        expect(def.label).toBe("Loading…");
    });

    it("leaves label undefined when not set", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount
        });
        expect(def.label).toBeUndefined();
    });

    // ── unchanged fields ─────────────────────────────────────────────────────

    it("passes showValue and displayType through unchanged", () => {
        const def = mapProgress({
            id: "p1",
            ...baseMount,
            showValue: true,
            displayType: "circular",
            value: { kind: "literal", value: 75 }
        });
        expect(def.showValue).toBe(true);
        expect(def.displayType).toBe("circular");
    });
});
