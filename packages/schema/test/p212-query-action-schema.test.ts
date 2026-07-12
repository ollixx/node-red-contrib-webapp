import { describe, expect, it } from "vitest";

import { uiQueryActionNodeDefinitionSchema, validateUiNodeDefinition } from "../src";

/**
 * P212 (ADR 0029) — the ui-query-action schema contract. A reference-based
 * TRIGGER node: `query` (required node-id reference), `action` (enum, default
 * "refresh", extensible), `mode` (enum, default "reference"), `parent` (owning
 * app; deploy-required via the P205 flow validation, so the schema keeps it
 * optional). Reachable through the discriminated dispatch.
 */
function makeAction(extra: Record<string, unknown>) {
    return validateUiNodeDefinition({
        type: "ui-query-action",
        id: "qa1",
        parent: "app1",
        query: "query1",
        ...extra
    });
}

describe("P212: ui-query-action schema", () => {
    it("accepts a minimal action and defaults action=refresh, mode=reference", () => {
        const result = makeAction({});
        expect(result.success).toBe(true);
        if (result.success && result.data.type === "ui-query-action") {
            expect(result.data.action).toBe("refresh");
            expect(result.data.mode).toBe("reference");
        }
    });

    it("accepts action=refresh", () => {
        expect(makeAction({ action: "refresh" }).success).toBe(true);
    });

    it.each(["reference", "wire"])("accepts mode=%s", (mode) => {
        expect(makeAction({ mode }).success).toBe(true);
    });

    it("rejects an unknown action", () => {
        expect(makeAction({ action: "reset" }).success).toBe(false);
    });

    it("rejects an unknown mode", () => {
        expect(makeAction({ mode: "broadcast" }).success).toBe(false);
    });

    it("rejects a missing query reference", () => {
        const result = validateUiNodeDefinition({ type: "ui-query-action", id: "a", parent: "app1" });
        expect(result.success).toBe(false);
    });

    it("rejects an empty query reference", () => {
        expect(makeAction({ query: "" }).success).toBe(false);
    });

    it("accepts a direct parse via the exported schema", () => {
        const result = uiQueryActionNodeDefinitionSchema.safeParse({
            type: "ui-query-action", id: "a", parent: "app1", query: "q", action: "refresh", mode: "wire"
        });
        expect(result.success).toBe(true);
    });

    it("is reachable through the discriminated dispatch as ui-query-action", () => {
        const result = makeAction({ action: "refresh", mode: "wire" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe("ui-query-action");
        }
    });
});
