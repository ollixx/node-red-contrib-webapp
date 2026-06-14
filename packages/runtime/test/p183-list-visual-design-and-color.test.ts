import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * P183 — ui-list Visual-Design + resolveColorValue
 *
 * Tests:
 *  1. resolveColorValue: semantic tokens, CSS values, unknown/invalid → undefined.
 *  2. Serializer HTML: displayType CSS classes (plain/divided/grouped/actionable).
 *  3. Row anatomy: icon, label, value placement in generated markup.
 *  4. color base field: 'primary' token → var(--wa-color-primary) in style attr.
 */

const require = createRequire(import.meta.url);

// The shared serializer is the testable surface for color resolution + HTML output.
const sharedSerializer = require("../../../resources/lib/webapp-serializer.js") as {
    resolveColorValue: (raw: unknown) => string | undefined;
    renderComponentHtml: (component: Record<string, unknown>, layoutId: string, ctx: Record<string, unknown>) => string;
};

const { resolveColorValue, renderComponentHtml } = sharedSerializer;

// ──────────────────────────────────────────────────────────────────────────────
// 1. resolveColorValue
// ──────────────────────────────────────────────────────────────────────────────

describe("P183: resolveColorValue", () => {
    it("semantic token 'primary' → var(--wa-color-primary)", () => {
        expect(resolveColorValue("primary")).toBe("var(--wa-color-primary)");
    });

    it("semantic token 'success' → var(--wa-color-success)", () => {
        expect(resolveColorValue("success")).toBe("var(--wa-color-success)");
    });

    it("semantic token 'warning' → var(--wa-color-warning)", () => {
        expect(resolveColorValue("warning")).toBe("var(--wa-color-warning)");
    });

    it("semantic token 'danger' → var(--wa-color-danger)", () => {
        expect(resolveColorValue("danger")).toBe("var(--wa-color-danger)");
    });

    it("semantic token 'neutral' → var(--wa-color-neutral)", () => {
        expect(resolveColorValue("neutral")).toBe("var(--wa-color-neutral)");
    });

    it("semantic token 'info' → var(--wa-color-primary) (maps to primary token)", () => {
        expect(resolveColorValue("info")).toBe("var(--wa-color-primary)");
    });

    it("semantic token matching is case-insensitive", () => {
        expect(resolveColorValue("Primary")).toBe("var(--wa-color-primary)");
        expect(resolveColorValue("SUCCESS")).toBe("var(--wa-color-success)");
    });

    it("#hex value passes through unchanged", () => {
        expect(resolveColorValue("#3b82f6")).toBe("#3b82f6");
        expect(resolveColorValue("#fff")).toBe("#fff");
    });

    it("rgb() value passes through unchanged", () => {
        expect(resolveColorValue("rgb(59,130,246)")).toBe("rgb(59,130,246)");
    });

    it("rgba() value passes through unchanged", () => {
        expect(resolveColorValue("rgba(0,0,0,0.5)")).toBe("rgba(0,0,0,0.5)");
    });

    it("hsl() value passes through unchanged", () => {
        expect(resolveColorValue("hsl(217,91%,60%)")).toBe("hsl(217,91%,60%)");
    });

    it("var() CSS custom property passes through unchanged", () => {
        expect(resolveColorValue("var(--my-color)")).toBe("var(--my-color)");
    });

    it("known CSS color keyword 'red' passes through", () => {
        expect(resolveColorValue("red")).toBe("red");
    });

    it("known CSS color keyword 'transparent' passes through", () => {
        expect(resolveColorValue("transparent")).toBe("transparent");
    });

    it("unknown bare word → undefined (no broken inline CSS)", () => {
        expect(resolveColorValue("banana")).toBeUndefined();
        expect(resolveColorValue("myBrand")).toBeUndefined();
    });

    it("empty string → undefined", () => {
        expect(resolveColorValue("")).toBeUndefined();
    });

    it("undefined → undefined", () => {
        expect(resolveColorValue(undefined)).toBeUndefined();
    });

    it("null → undefined", () => {
        expect(resolveColorValue(null)).toBeUndefined();
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers for HTML rendering tests
// ──────────────────────────────────────────────────────────────────────────────

function makeList(overrides: Record<string, unknown> = {}) {
    return {
        id: "list1",
        kind: "list",
        mount: "app1/content",
        props: {
            items: [
                { id: "a", label: "Eins", value: "1" },
                { id: "b", label: "Zwei" }
            ],
            displayValue: "none",
            displayType: "plain",
            ...overrides
        },
        events: [],
        value: undefined,
        disabled: false,
        ...overrides.topLevel as object
    };
}

function renderList(overrides: Record<string, unknown> = {}, topLevel: Record<string, unknown> = {}) {
    const component = {
        id: "list1",
        kind: "list",
        mount: "app1/content",
        props: {
            items: [
                { id: "a", label: "Eins", value: "1" },
                { id: "b", label: "Zwei" }
            ],
            displayValue: "none",
            displayType: "plain",
            ...overrides
        },
        events: [],
        value: undefined,
        disabled: false,
        ...topLevel
    };
    return renderComponentHtml(component, "main", {});
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. displayType CSS classes
// ──────────────────────────────────────────────────────────────────────────────

describe("P183: ui-list displayType CSS classes in rendered HTML", () => {
    it("plain (default) — no modifier class, just webapp-list", () => {
        const html = renderList({ displayType: "plain" });
        expect(html).toContain("class=\"webapp-list\"");
        expect(html).not.toContain("webapp-list--divided");
        expect(html).not.toContain("webapp-list--grouped");
        expect(html).not.toContain("webapp-list--actionable");
    });

    it("absent displayType → treated as plain (no modifier class)", () => {
        const html = renderList({ displayType: undefined });
        expect(html).toContain("class=\"webapp-list\"");
        expect(html).not.toContain("webapp-list--divided");
    });

    it("divided — adds webapp-list--divided class", () => {
        const html = renderList({ displayType: "divided" });
        expect(html).toContain("webapp-list--divided");
    });

    it("grouped — adds webapp-list--grouped class", () => {
        const html = renderList({ displayType: "grouped" });
        expect(html).toContain("webapp-list--grouped");
    });

    it("actionable — adds webapp-list--actionable class", () => {
        const html = renderList({ displayType: "actionable" });
        expect(html).toContain("webapp-list--actionable");
    });

    it("migration: old 'default' → plain (no modifier class)", () => {
        const html = renderList({ displayType: "default" });
        expect(html).toContain("class=\"webapp-list\"");
        expect(html).not.toContain("webapp-list--divided");
    });

    it("migration: old 'compact' → plain (no modifier class)", () => {
        const html = renderList({ displayType: "compact" });
        expect(html).toContain("class=\"webapp-list\"");
        expect(html).not.toContain("webapp-list--divided");
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Row anatomy: webapp-list-item, icon class, label, value placement
// ──────────────────────────────────────────────────────────────────────────────

describe("P183: ui-list row anatomy in rendered HTML", () => {
    it("each row has webapp-list-item class", () => {
        const html = renderList();
        const matches = html.match(/class="webapp-list-item"/g);
        expect(matches).toBeTruthy();
        expect(matches!.length).toBe(2);
    });

    it("icon with webapp-list-item-icon class is injected for items with icon", () => {
        const html = renderList({
            items: [
                { id: "a", label: "Home", icon: "house" }
            ]
        });
        expect(html).toContain("webapp-list-item-icon");
        expect(html).toContain("name=\"house\"");
    });

    it("items without icon render no icon element", () => {
        const html = renderList({
            items: [{ id: "a", label: "NoIcon" }]
        });
        expect(html).not.toContain("webapp-list-item-icon");
        expect(html).not.toContain("<sl-icon");
    });

    it("string-shorthand items render no icon", () => {
        const html = renderList({ items: ["Eins", "Zwei"] });
        expect(html).not.toContain("webapp-list-item-icon");
        expect(html).not.toContain("<sl-icon");
    });

    it("displayValue=secondary: value renders in webapp-list-value span (not stuck to label)", () => {
        const html = renderList({
            items: [{ id: "a", label: "Eins", value: "1" }],
            displayValue: "secondary"
        });
        expect(html).toContain("<span class=\"webapp-list-value\">1</span>");
        // The label text and the value must NOT be directly adjacent (no 'Eins1')
        expect(html).not.toMatch(/Eins1/);
    });

    it("displayValue=badge: value renders as sl-badge with webapp-list-value class", () => {
        const html = renderList({
            items: [{ id: "a", label: "Tasks", value: "3" }],
            displayValue: "badge",
            badgeVariant: "primary"
        });
        expect(html).toContain("class=\"webapp-list-value\"");
        expect(html).toContain("<sl-badge");
        expect(html).not.toMatch(/Tasks3/);
    });

    it("displayValue=none: value is not rendered in the HTML", () => {
        const html = renderList({
            items: [{ id: "a", label: "Eins", value: "hidden" }],
            displayValue: "none"
        });
        expect(html).not.toContain("hidden");
        expect(html).not.toContain("webapp-list-value");
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. color base field: token → CSS var, CSS value passthrough, unknown ignored
// ──────────────────────────────────────────────────────────────────────────────

describe("P183: ui-list color base-field resolution in rendered HTML", () => {
    it("color='primary' → style with var(--wa-color-primary)", () => {
        const html = renderList({}, { props: {
            items: [{ id: "a", label: "Eins" }],
            displayValue: "none",
            displayType: "plain",
            color: "primary"
        }});
        expect(html).toContain("var(--wa-color-primary)");
    });

    it("color='#ff0000' → style with #ff0000 passed through", () => {
        const html = renderList({}, { props: {
            items: [{ id: "a", label: "Eins" }],
            displayValue: "none",
            displayType: "plain",
            color: "#ff0000"
        }});
        expect(html).toContain("color:#ff0000");
    });

    it("color='success' → style with var(--wa-color-success)", () => {
        const html = renderList({}, { props: {
            items: [{ id: "a", label: "Eins" }],
            displayValue: "none",
            displayType: "plain",
            color: "success"
        }});
        expect(html).toContain("var(--wa-color-success)");
    });

    it("color='banana' (unknown) → no style attribute emitted", () => {
        const html = renderList({}, { props: {
            items: [{ id: "a", label: "Eins" }],
            displayValue: "none",
            displayType: "plain",
            color: "banana"
        }});
        // No style="color:..." on the list element
        expect(html).not.toMatch(/style="color:/);
    });

    it("color absent → no style attribute emitted", () => {
        const html = renderList({}, { props: {
            items: [{ id: "a", label: "Eins" }],
            displayValue: "none",
            displayType: "plain"
        }});
        expect(html).not.toMatch(/style="color:/);
    });
});
