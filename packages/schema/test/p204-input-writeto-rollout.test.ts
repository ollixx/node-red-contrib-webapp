import { describe, expect, it } from "vitest";

import { validateUiNodeDefinition } from "../src";

/**
 * P204 (ADR 0027): the `writeTo` (+ `writeTrigger`) contract rolled out to the
 * remaining seven input controls. Each gains the same optional writable-only
 * `writeTo` binding and `writeTrigger` (change|submit, default submit) that P203
 * proved on ui-input.
 */

const MOUNT = "route:/x/content";

// Minimal valid config per node (label/value shapes vary by node — see P133/P136/…).
const baseByType: Record<string, Record<string, unknown>> = {
    "ui-select": { type: "ui-select", id: "sel1", mount: MOUNT, label: "Choose", value: { kind: "state", path: "sel" } },
    "ui-checkbox": { type: "ui-checkbox", id: "cb1", mount: MOUNT, label: "Agree", value: { kind: "state", path: "agree" } },
    "ui-switch": { type: "ui-switch", id: "sw1", mount: MOUNT, value: { kind: "state", path: "on" } },
    "ui-textarea": { type: "ui-textarea", id: "ta1", mount: MOUNT, label: "Notes", value: { kind: "state", path: "notes" } },
    "ui-slider": { type: "ui-slider", id: "sl1", mount: MOUNT, value: { kind: "state", path: "vol" } },
    "ui-radio": { type: "ui-radio", id: "rd1", mount: MOUNT, label: "Pick", value: { kind: "state", path: "pick" } },
    "ui-datepicker": { type: "ui-datepicker", id: "dp1", mount: MOUNT, label: "Date", value: { kind: "state", path: "when" } }
};

const TYPES = Object.keys(baseByType);

describe("P204 (ADR 0027): writeTo/writeTrigger rollout to the remaining input controls", () => {
    describe.each(TYPES)("%s", (type) => {
        const base = baseByType[type];

        it("accepts a store writeTo + writeTrigger", () => {
            const result = validateUiNodeDefinition({
                ...base,
                writeTo: { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "k" } },
                writeTrigger: "change"
            });
            expect(result.success, JSON.stringify(result)).toBe(true);
            if (result.success) {
                expect((result.data as { writeTrigger?: string }).writeTrigger).toBe("change");
            }
        });

        it("accepts a flow writeTo", () => {
            expect(validateUiNodeDefinition({ ...base, writeTo: { kind: "flow", path: "k" } }).success).toBe(true);
        });

        it("accepts a global writeTo", () => {
            expect(validateUiNodeDefinition({ ...base, writeTo: { kind: "global", path: "k" } }).success).toBe(true);
        });

        it("defaults writeTrigger to submit when a writeTo is present but no trigger", () => {
            const result = validateUiNodeDefinition({ ...base, writeTo: { kind: "store", path: "draftStore" } });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as { writeTrigger?: string }).writeTrigger).toBe("submit");
            }
        });

        it("accepts the node with no writeTo (write-back optional)", () => {
            expect(validateUiNodeDefinition(base).success).toBe(true);
        });

        it("rejects a non-writable writeTo kind (query)", () => {
            expect(validateUiNodeDefinition({ ...base, writeTo: { kind: "query", path: "q" } }).success).toBe(false);
        });

        it("strips the legacy storeId/path write-target pair from the contract", () => {
            const result = validateUiNodeDefinition({ ...base, storeId: "draftStore", path: "k" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).storeId).toBeUndefined();
                expect((result.data as Record<string, unknown>).path).toBeUndefined();
            }
        });
    });
});
