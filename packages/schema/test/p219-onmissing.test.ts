import { describe, expect, it } from "vitest";

import { ON_MISSING_BEHAVIORS, bindingSchema, leafBindingSchema } from "../src";

/**
 * P219 (ADR 0034): the optional per-field `onMissing` enum on the canonical
 * value-binding contract. Absent → treated as `marker` (default) by the renderer;
 * invalid values are rejected by Zod; existing definitions still validate.
 */

describe("P219 (ADR 0034): onMissing on the value-binding contract", () => {
    it("exposes exactly the two foundation behaviours (extensible in P220)", () => {
        expect(ON_MISSING_BEHAVIORS).toEqual(["marker", "ignore"]);
    });

    it("accepts onMissing:marker and onMissing:ignore", () => {
        expect(bindingSchema.safeParse({ kind: "reactive", value: "x", onMissing: "marker" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "reactive", value: "x", onMissing: "ignore" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "store", path: "s1", onMissing: "ignore" }).success).toBe(true);
    });

    it("treats onMissing as optional — a binding without it still validates", () => {
        expect(bindingSchema.safeParse({ kind: "literal", value: "hello" }).success).toBe(true);
        expect(bindingSchema.safeParse({ kind: "reactive", value: "x" }).success).toBe(true);
    });

    it("rejects an unknown onMissing value", () => {
        const result = bindingSchema.safeParse({ kind: "reactive", value: "x", onMissing: "explode" });
        expect(result.success).toBe(false);
    });

    it("carries onMissing on a store sub-path leaf binding too", () => {
        expect(leafBindingSchema.safeParse({ kind: "literal", value: "c", onMissing: "ignore" }).success).toBe(true);
        expect(leafBindingSchema.safeParse({ kind: "literal", value: "c", onMissing: "nope" }).success).toBe(false);
    });
});
