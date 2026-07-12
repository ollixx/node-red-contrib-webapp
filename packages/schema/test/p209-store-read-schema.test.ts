import { describe, expect, it } from "vitest";

import { uiStoreReadNodeDefinitionSchema, validateUiNodeDefinition } from "../src";

/**
 * P209 (ADR 0028) — the ui-store-read schema contract. A reference-based reader:
 * `store` (required node-id reference), optional `path` (default sub-path),
 * `parent` (owning app; deploy-required via the P205 flow validation, so the
 * schema keeps it optional). Reachable through the discriminated dispatch.
 */
function makeRead(extra: Record<string, unknown>) {
    return validateUiNodeDefinition({
        type: "ui-store-read",
        id: "read1",
        parent: "app1",
        store: "store1",
        ...extra
    });
}

describe("P209: ui-store-read schema", () => {
    it("accepts a minimal reader (store + parent, no path)", () => {
        expect(makeRead({}).success).toBe(true);
    });

    it("accepts an optional default path", () => {
        expect(makeRead({ path: "name" }).success).toBe(true);
    });

    it("rejects a missing store reference", () => {
        const result = validateUiNodeDefinition({ type: "ui-store-read", id: "r", parent: "app1" });
        expect(result.success).toBe(false);
    });

    it("rejects an empty store reference", () => {
        expect(makeRead({ store: "" }).success).toBe(false);
    });

    it("rejects an empty path when present", () => {
        // path is optional, but if present it must be non-empty
        const result = uiStoreReadNodeDefinitionSchema.safeParse({
            type: "ui-store-read", id: "r", parent: "app1", store: "s", path: ""
        });
        expect(result.success).toBe(false);
    });

    it("is reachable through the discriminated dispatch", () => {
        const result = makeRead({ path: "city" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe("ui-store-read");
        }
    });
});
