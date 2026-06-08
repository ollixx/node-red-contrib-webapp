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
 * P92 — ui-badge Felder-Rework.
 *
 * Deliverables:
 *   1. displayType square/rounded/pill → maps to Shoelace pill attr / data-display-type.
 *   2. max field removed — not emitted in mapConfig or serializer output.
 *   3. pulsating boolean → Shoelace `pulse` attr.
 *   4. size (sm/md/lg) → data-size attr (sl-badge has no native size attr).
 *   5. severity → variant rename: mapConfig reads `variant` (+ back-compat `severity`).
 */

// ── mapConfig tests ────────────────────────────────────────────────────────

describe("P92: ui-badge — mapConfig", () => {
    const reg = runtimeNodeRegistry["ui-badge"];
    const base = { id: "b1", mount: "route:/main/content", value: { kind: "literal", value: "5" } };

    it("variant is read from config.variant", () => {
        const def = reg.mapConfig({ ...base, variant: "success" }) as Record<string, unknown>;
        expect(def.variant).toBe("success");
    });

    it("back-compat: severity field in old config → becomes variant", () => {
        const def = reg.mapConfig({ ...base, severity: "danger" }) as Record<string, unknown>;
        expect(def.variant).toBe("danger");
    });

    it("displayType 'pill' → preserved in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, displayType: "pill" }) as Record<string, unknown>;
        expect(def.displayType).toBe("pill");
    });

    it("displayType 'square' → preserved in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, displayType: "square" }) as Record<string, unknown>;
        expect(def.displayType).toBe("square");
    });

    it("displayType 'rounded' → preserved in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, displayType: "rounded" }) as Record<string, unknown>;
        expect(def.displayType).toBe("rounded");
    });

    it("back-compat: legacy displayType 'count' → mapped to 'rounded'", () => {
        const def = reg.mapConfig({ ...base, displayType: "count" }) as Record<string, unknown>;
        expect(def.displayType).toBe("rounded");
    });

    it("back-compat: legacy displayType 'dot' → mapped to 'rounded'", () => {
        const def = reg.mapConfig({ ...base, displayType: "dot" }) as Record<string, unknown>;
        expect(def.displayType).toBe("rounded");
    });

    it("back-compat: legacy displayType 'status' → mapped to 'rounded'", () => {
        const def = reg.mapConfig({ ...base, displayType: "status" }) as Record<string, unknown>;
        expect(def.displayType).toBe("rounded");
    });

    it("pulsating: true → preserved in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, pulsating: true }) as Record<string, unknown>;
        expect(def.pulsating).toBe(true);
    });

    it("pulsating: 'true' (string from editor checkbox) → coerced to true", () => {
        const def = reg.mapConfig({ ...base, pulsating: "true" }) as Record<string, unknown>;
        expect(def.pulsating).toBe(true);
    });

    it("pulsating absent → not set (or falsy) in mapConfig result", () => {
        const def = reg.mapConfig({ ...base }) as Record<string, unknown>;
        expect(def.pulsating).toBeFalsy();
    });

    it("size 'sm' → preserved in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, size: "sm" }) as Record<string, unknown>;
        expect(def.size).toBe("sm");
    });

    it("size 'lg' → preserved in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, size: "lg" }) as Record<string, unknown>;
        expect(def.size).toBe("lg");
    });

    it("size absent → not set in mapConfig result", () => {
        const def = reg.mapConfig({ ...base }) as Record<string, unknown>;
        expect(def.size).toBeFalsy();
    });

    it("max field is removed — not emitted by mapConfig", () => {
        const def = reg.mapConfig({ ...base, max: 99 }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("max");
    });
});

// ── serializer tests ────────────────────────────────────────────────────────

describe("P92: ui-badge — serializer", () => {
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

    // variant → Shoelace `variant` attr
    it("variant 'success' → sl-badge has variant='success'", () => {
        const html = renderComponentHtml(makeBadge({ variant: "success" }), "main", {});
        expect(html).toContain("variant=\"success\"");
    });

    it("variant 'danger' → sl-badge has variant='danger'", () => {
        const html = renderComponentHtml(makeBadge({ variant: "danger" }), "main", {});
        expect(html).toContain("variant=\"danger\"");
    });

    it("back-compat: severity in props → used as variant", () => {
        const html = renderComponentHtml(makeBadge({ severity: "warning" }), "main", {});
        expect(html).toContain("variant=\"warning\"");
    });

    it("no variant → sl-badge renders with default neutral variant", () => {
        const html = renderComponentHtml(makeBadge(), "main", {});
        expect(html).toContain("<sl-badge");
        expect(html).toContain("variant=");
    });

    // displayType → pill / data-display-type
    it("displayType 'pill' → sl-badge has pill attribute", () => {
        const html = renderComponentHtml(makeBadge({ displayType: "pill" }), "main", {});
        expect(html).toContain(" pill");
    });

    it("displayType 'square' → sl-badge has data-display-type='square'", () => {
        const html = renderComponentHtml(makeBadge({ displayType: "square" }), "main", {});
        expect(html).toContain("data-display-type=\"square\"");
    });

    it("displayType 'rounded' → sl-badge has no pill and no data-display-type", () => {
        const html = renderComponentHtml(makeBadge({ displayType: "rounded" }), "main", {});
        // 'rounded' is the default — no special attribute
        expect(html).not.toContain(" pill");
        expect(html).not.toContain("data-display-type");
    });

    it("displayType absent → no pill attribute", () => {
        const html = renderComponentHtml(makeBadge(), "main", {});
        expect(html).not.toContain(" pill");
    });

    // pulsating → `pulse` attr
    it("pulsating: true → sl-badge has pulse attribute", () => {
        const html = renderComponentHtml(makeBadge({ pulsating: true }), "main", {});
        expect(html).toContain(" pulse");
    });

    it("pulsating absent → sl-badge has no pulse attribute", () => {
        const html = renderComponentHtml(makeBadge(), "main", {});
        expect(html).not.toContain(" pulse");
    });

    // size → data-size
    it("size 'sm' → sl-badge has data-size='sm'", () => {
        const html = renderComponentHtml(makeBadge({ size: "sm" }), "main", {});
        expect(html).toContain("data-size=\"sm\"");
    });

    it("size 'md' → sl-badge has data-size='md'", () => {
        const html = renderComponentHtml(makeBadge({ size: "md" }), "main", {});
        expect(html).toContain("data-size=\"md\"");
    });

    it("size 'lg' → sl-badge has data-size='lg'", () => {
        const html = renderComponentHtml(makeBadge({ size: "lg" }), "main", {});
        expect(html).toContain("data-size=\"lg\"");
    });

    it("size absent → sl-badge has no data-size attribute", () => {
        const html = renderComponentHtml(makeBadge(), "main", {});
        expect(html).not.toContain("data-size=");
    });

    // value rendering
    it("value is rendered inside sl-badge", () => {
        const html = renderComponentHtml(makeBadge({ variant: "neutral" }), "main", {});
        expect(html).toContain(">42<");
    });

    // no max in output
    it("max (removed field) does not appear in serializer output", () => {
        const html = renderComponentHtml(makeBadge({ max: 99 }), "main", {});
        expect(html).not.toContain("max=");
    });

    // combined
    it("pill + pulsating + variant renders all correct attributes together", () => {
        const html = renderComponentHtml(
            makeBadge({ displayType: "pill", variant: "primary", pulsating: true, size: "md" }),
            "main",
            {}
        );
        expect(html).toContain(" pill");
        expect(html).toContain(" pulse");
        expect(html).toContain("variant=\"primary\"");
        expect(html).toContain("data-size=\"md\"");
    });
});
