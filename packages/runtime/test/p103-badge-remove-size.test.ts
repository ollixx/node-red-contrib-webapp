import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
    };
};

const { runtimeNodeRegistry, renderComponentHtml } = webapp.__test__;

/**
 * P103 — ui-badge: size-Feld komplett entfernen.
 *
 * Deliverables:
 *   1. Schema: `size` removed from uiBadgeNodeDefinitionSchema.
 *      Back-compat: a Badge definition with `size` in an old flow loads without error
 *      (Zod strips unknown fields silently).
 *   2. mapConfig: `size` is NOT emitted for badge.
 *   3. Serializer: NO `data-size` attribute emitted on <sl-badge>.
 *   4. All other badge fields (variant, displayType, pulsating, value) unaffected.
 */

// ── mapConfig: size must NOT appear ────────────────────────────────────────

describe("P103: ui-badge — mapConfig — size removed", () => {
    const reg = runtimeNodeRegistry["ui-badge"];
    const base = { id: "b1", mount: "route:/main/content", value: { kind: "literal", value: "5" } };

    it("size field is NOT emitted by mapConfig (explicit size in old flow config is ignored)", () => {
        const def = reg.mapConfig({ ...base, size: "sm" }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("size");
    });

    it("size 'md' in old config → not present in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, size: "md" }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("size");
    });

    it("size 'lg' in old config → not present in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, size: "lg" }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("size");
    });

    it("other badge fields (variant, displayType, pulsating) still work after size removal", () => {
        const def = reg.mapConfig({
            ...base,
            variant: "success",
            displayType: "pill",
            pulsating: true,
            size: "md" // old field — should be ignored
        }) as Record<string, unknown>;
        expect(def.variant).toBe("success");
        expect(def.displayType).toBe("pill");
        expect(def.pulsating).toBe(true);
        expect(def).not.toHaveProperty("size");
    });
});

// ── Serializer: data-size must NOT appear ──────────────────────────────────

describe("P103: ui-badge — serializer — no data-size", () => {
    function makeBadge(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            id: "badge1",
            kind: "badge",
            mount: "route:/main/content",
            order: undefined,
            bind: {},
            props: { ...overrides },
            value: "42",
            events: []
        };
    }

    it("no size in props → no data-size attribute in HTML", () => {
        const html = renderComponentHtml(makeBadge(), "main", {});
        expect(html).not.toContain("data-size=");
    });

    it("size 'sm' in props (old snapshot) → no data-size attribute in HTML (field removed)", () => {
        const html = renderComponentHtml(makeBadge({ size: "sm" }), "main", {});
        expect(html).not.toContain("data-size=");
    });

    it("size 'lg' in props (old snapshot) → no data-size attribute in HTML (field removed)", () => {
        const html = renderComponentHtml(makeBadge({ size: "lg" }), "main", {});
        expect(html).not.toContain("data-size=");
    });

    it("sl-badge is still rendered correctly without size", () => {
        const html = renderComponentHtml(makeBadge({ variant: "success" }), "main", {});
        expect(html).toContain("<sl-badge");
        expect(html).toContain("variant=\"success\"");
        expect(html).toContain(">42<");
    });

    it("all other attrs still work: pill + pulse + variant, no data-size", () => {
        const html = renderComponentHtml(
            makeBadge({ displayType: "pill", variant: "primary", pulsating: true }),
            "main",
            {}
        );
        expect(html).toContain(" pill");
        expect(html).toContain(" pulse");
        expect(html).toContain("variant=\"primary\"");
        expect(html).not.toContain("data-size=");
    });
});
