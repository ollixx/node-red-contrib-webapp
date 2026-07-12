import { describe, expect, it } from "vitest";

import { uiStoreActionNodeDefinitionSchema, validateUiNodeDefinition } from "../src";

/**
 * P211 (ADR 0029) — the ui-store-action schema contract. A reference-based
 * MUTATION node: `store` (required node-id reference), `op` (enum, default
 * "set"), optional `path` (one-level sub-path), `mode` (enum, default
 * "reference"), `parent` (owning app; deploy-required via the P205 flow
 * validation, so the schema keeps it optional). Reachable through the
 * discriminated dispatch.
 */
function makeAction(extra: Record<string, unknown>) {
    return validateUiNodeDefinition({
        type: "ui-store-action",
        id: "act1",
        parent: "app1",
        store: "store1",
        ...extra
    });
}

describe("P211: ui-store-action schema", () => {
    it("accepts a minimal action and defaults op=set, mode=reference", () => {
        const result = makeAction({});
        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-store-action") {
            expect(result.data.op).toBe("set");
            expect(result.data.mode).toBe("reference");
        }
    });

    it.each(["set", "patch", "delete", "replace", "reset"])("accepts op=%s", (op) => {
        expect(makeAction({ op }).success).toBe(true);
    });

    it.each(["reference", "wire"])("accepts mode=%s", (mode) => {
        expect(makeAction({ mode }).success).toBe(true);
    });

    it("rejects an unknown op", () => {
        expect(makeAction({ op: "increment" }).success).toBe(false);
    });

    it("rejects an unknown mode", () => {
        expect(makeAction({ mode: "broadcast" }).success).toBe(false);
    });

    it("rejects a missing store reference", () => {
        const result = validateUiNodeDefinition({ type: "ui-store-action", id: "a", parent: "app1" });
        expect(result.success).toBe(false);
    });

    it("rejects an empty store reference", () => {
        expect(makeAction({ store: "" }).success).toBe(false);
    });

    it("rejects an empty path when present", () => {
        const result = uiStoreActionNodeDefinitionSchema.safeParse({
            type: "ui-store-action", id: "a", parent: "app1", store: "s", path: ""
        });
        expect(result.success).toBe(false);
    });

    it("accepts an optional non-empty path", () => {
        expect(makeAction({ path: "name" }).success).toBe(true);
    });

    it("is reachable through the discriminated dispatch as ui-store-action", () => {
        const result = makeAction({ op: "patch", path: "city", mode: "wire" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe("ui-store-action");
        }
    });
});
