import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * P241 — ui-skeleton render pipeline (unit level).
 *
 * Before P241 the node rendered NOTHING: there was no `skeleton` serializer branch
 * and no KIND_TO_SHOELACE entry, so displayType/lines/visible/color had zero
 * observable effect. These are the unit-level locks for the browser-measured E2E
 * (tests/e2e/nodes/view/ui-skeleton.spec.ts):
 *
 *  - the compile pass (toComponentDefinitions) maps ui-skeleton → kind "skeleton",
 *    routes a `color` binding into bind.color, `visible` into visibleIf, and carries
 *    displayType/lines in props;
 *  - the serializer composes the four displayType forms out of <sl-skeleton> and
 *    applies the resolved colour as the sl-skeleton `--color` custom property.
 */

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        toComponentDefinitions: (components: unknown[]) => Array<Record<string, unknown>>;
    };
};
const { toComponentDefinitions } = webapp.__test__;

function compile(config: Record<string, unknown>): Record<string, unknown> {
    return toComponentDefinitions([config])[0];
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
    mapComponentToShoelace: (kind: string, props?: unknown) => { tag: string; fallback: boolean };
};

const ctx = { appId: "app1", location: "/" };
const mount = "route:/main/content";

function skeleton(props: Record<string, unknown>): unknown {
    return { kind: "skeleton", id: "sk", props };
}

// Count occurrences of a substring.
function count(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe("P241: adapter — skeleton is a real element, not a fallback", () => {
    it("maps skeleton → sl-skeleton (ends the data-wa-fallback path)", () => {
        const descriptor = serializer.mapComponentToShoelace("skeleton");
        expect(descriptor.tag).toBe("sl-skeleton");
        expect(descriptor.fallback).toBe(false);
    });
});

describe("P241: toComponentDefinitions — ui-skeleton → kind skeleton + base fields", () => {
    it("maps ui-skeleton to the skeleton kind (was a text fallback before)", () => {
        const def = compile({ type: "ui-skeleton", id: "s1", mount, displayType: "text", lines: 4 });
        expect(def.kind).toBe("skeleton");
        expect((def.props as Record<string, unknown>).displayType).toBe("text");
        expect((def.props as Record<string, unknown>).lines).toBe(4);
    });

    it("routes a color binding object into bind.color (base field, generic)", () => {
        const def = compile({ type: "ui-skeleton", id: "s2", mount, color: { kind: "store", path: "skelColor" } });
        expect((def.bind as Record<string, unknown>).color).toEqual({ kind: "store", path: "skelColor" });
    });

    it("routes a visible binding into visibleIf (render-gate)", () => {
        const def = compile({ type: "ui-skeleton", id: "s3", mount, visible: { kind: "store", path: "isLoading" } });
        expect(def.visibleIf).toEqual({ kind: "store", path: "isLoading" });
    });

    it("keeps a plain-literal color in props (only binding objects go to bind.color)", () => {
        const def = compile({ type: "ui-skeleton", id: "s4", mount, color: "#123456" });
        expect((def.bind as Record<string, unknown>).color).toBeUndefined();
        expect((def.props as Record<string, unknown>).color).toBe("#123456");
    });
});

describe("P241: serializer — the four displayType forms compose <sl-skeleton>", () => {
    it("text (default): renders `lines` placeholder lines", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "text", lines: 5 }), "vertical", ctx);
        expect(html).toContain("webapp-skeleton--text");
        expect(count(html, "webapp-skeleton-line")).toBe(5);
        expect(count(html, "<sl-skeleton")).toBe(5);
    });

    it("text: lines=1 renders exactly one line", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "text", lines: 1 }), "vertical", ctx);
        expect(count(html, "webapp-skeleton-line")).toBe(1);
    });

    it("text: absent/invalid lines defaults to 3 (serializer is the last line)", () => {
        expect(count(serializer.renderComponentHtml(skeleton({ displayType: "text" }), "vertical", ctx), "webapp-skeleton-line")).toBe(3);
        expect(count(serializer.renderComponentHtml(skeleton({ displayType: "text", lines: 0 }), "vertical", ctx), "webapp-skeleton-line")).toBe(3);
        expect(count(serializer.renderComponentHtml(skeleton({ displayType: "text", lines: -2 }), "vertical", ctx), "webapp-skeleton-line")).toBe(3);
    });

    it("avatar: a single round placeholder (border-radius 50%, width == height)", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "avatar" }), "vertical", ctx);
        expect(html).toContain("webapp-skeleton--avatar");
        expect(html).toContain("--border-radius:50%");
        expect(html).toMatch(/width:3rem;height:3rem/);
        expect(count(html, "webapp-skeleton-line")).toBe(0);
    });

    it("card: a media block plus body lines in a bordered box", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "card" }), "vertical", ctx);
        expect(html).toContain("webapp-skeleton--card");
        expect(count(html, "webapp-skeleton-block")).toBe(1);
        expect(html).toContain("border:1px solid");
    });

    it("table: `lines` rows × 3 columns (Owner-Entscheid)", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "table", lines: 4 }), "vertical", ctx);
        expect(html).toContain("webapp-skeleton--table");
        expect(count(html, "webapp-skeleton-row")).toBe(4);
        expect(count(html, "webapp-skeleton-cell")).toBe(12);
    });

    it("color: applies the resolved colour as sl-skeleton --color (measurable fill)", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "text", lines: 1, color: "#ff0000" }), "vertical", ctx);
        expect(html).toContain("--color:#ff0000");
    });

    it("color: a semantic token maps to the --wa-color-* var", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "avatar", color: "primary" }), "vertical", ctx);
        expect(html).toContain("--color:var(--wa-color-primary)");
    });

    it("uses effect=\"pulse\" so the indicator background stays the resolved colour", () => {
        const html = serializer.renderComponentHtml(skeleton({ displayType: "text", lines: 1 }), "vertical", ctx);
        expect(html).toContain('effect="pulse"');
    });
});
