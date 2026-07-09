import { describe, expect, it } from "vitest";

import {
    validateUiNodeDefinition,
    writeToBindingSchema,
    writeTriggerSchema,
    WRITABLE_BINDING_KINDS,
    WRITE_TRIGGERS
} from "../src";

const baseInput = {
    type: "ui-input" as const,
    id: "in1",
    mount: "route:/x/content",
    label: "Name",
    value: { kind: "state", path: "customer.name" }
};

describe("P203 (ADR 0027): writeTo binding — the WRITE half, writable kinds only", () => {
    describe("writeToBindingSchema", () => {
        it("accepts a store target with a literal subPath", () => {
            const result = writeToBindingSchema.safeParse({
                kind: "store",
                path: "draftStore",
                subPath: { kind: "literal", value: "name" }
            });
            expect(result.success).toBe(true);
        });

        it("accepts a store target without a subPath (whole slice)", () => {
            const result = writeToBindingSchema.safeParse({ kind: "store", path: "draftStore" });
            expect(result.success).toBe(true);
        });

        it("accepts a flow target", () => {
            expect(writeToBindingSchema.safeParse({ kind: "flow", path: "k" }).success).toBe(true);
        });

        it("accepts a global target", () => {
            expect(writeToBindingSchema.safeParse({ kind: "global", path: "k" }).success).toBe(true);
        });

        it("exposes exactly store/flow/global as writable kinds", () => {
            expect([...WRITABLE_BINDING_KINDS]).toEqual(["store", "flow", "global"]);
        });

        it.each(["query", "routeParam", "reactive", "literal", "msg", "jsonata", "env", "item", "index", "prop"])(
            "rejects the non-writable kind %s",
            (kind) => {
                const result = writeToBindingSchema.safeParse({ kind, path: "x" });
                expect(result.success).toBe(false);
            }
        );

        it("rejects a subPath on a non-store (flow) target", () => {
            const result = writeToBindingSchema.safeParse({
                kind: "flow",
                path: "k",
                subPath: { kind: "literal", value: "x" }
            });
            expect(result.success).toBe(false);
        });

        it("rejects a writable target with no path", () => {
            expect(writeToBindingSchema.safeParse({ kind: "store" }).success).toBe(false);
        });
    });

    describe("writeTriggerSchema", () => {
        it("defaults to submit", () => {
            expect(writeTriggerSchema.parse(undefined)).toBe("submit");
        });

        it("accepts change and submit", () => {
            expect(writeTriggerSchema.parse("change")).toBe("change");
            expect(writeTriggerSchema.parse("submit")).toBe("submit");
        });

        it("rejects an unknown trigger", () => {
            expect(writeTriggerSchema.safeParse("blur").success).toBe(false);
        });

        it("exposes exactly change/submit as triggers", () => {
            expect([...WRITE_TRIGGERS]).toEqual(["change", "submit"]);
        });
    });

    describe("uiInputNodeDefinitionSchema integration", () => {
        it("accepts an input with a store writeTo + writeTrigger", () => {
            const result = validateUiNodeDefinition({
                ...baseInput,
                writeTo: { kind: "store", path: "draftStore", subPath: { kind: "literal", value: "name" } },
                writeTrigger: "submit"
            });
            expect(result.success, JSON.stringify(result)).toBe(true);
        });

        it("defaults writeTrigger to submit when a writeTo is present but no trigger given", () => {
            const result = validateUiNodeDefinition({
                ...baseInput,
                writeTo: { kind: "store", path: "draftStore" }
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as { writeTrigger?: string }).writeTrigger).toBe("submit");
            }
        });

        it("accepts an input with no writeTo (write-back optional)", () => {
            expect(validateUiNodeDefinition(baseInput).success).toBe(true);
        });

        it("rejects an input whose writeTo uses a non-writable kind (query)", () => {
            const result = validateUiNodeDefinition({
                ...baseInput,
                writeTo: { kind: "query", path: "q" }
            });
            expect(result.success).toBe(false);
        });

        it("no longer accepts the legacy storeId/path write-target pair (stripped)", () => {
            const result = validateUiNodeDefinition({
                ...baseInput,
                storeId: "draftStore",
                path: "name"
            });
            // Unknown keys are stripped; the node itself still validates, but the
            // legacy pair does not survive onto the parsed contract.
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).storeId).toBeUndefined();
                expect((result.data as Record<string, unknown>).path).toBeUndefined();
            }
        });
    });
});
