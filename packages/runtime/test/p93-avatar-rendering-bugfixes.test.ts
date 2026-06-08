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
 * P93 — ui-avatar Rendering-Bugfixes.
 *
 * Deliverables:
 *   1. size is rendered via data-size attribute on sl-avatar.
 *   2. shape 'square' → sl-avatar has shape="square".
 *   3. Fallback initials (plain string) are rendered as initials="..." attribute on sl-avatar.
 *   4. alt attribute removed — not emitted by mapConfig and not in serializer output.
 */

// ── mapConfig tests ────────────────────────────────────────────────────────

describe("P93: ui-avatar — mapConfig", () => {
    const reg = runtimeNodeRegistry["ui-avatar"];
    const base = { id: "av1", mount: "route:/main/content" };

    it("size 'sm' is stored in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, size: "sm" }) as Record<string, unknown>;
        expect(def.size).toBe("sm");
    });

    it("size 'lg' is stored in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, size: "lg" }) as Record<string, unknown>;
        expect(def.size).toBe("lg");
    });

    it("shape 'square' is stored in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, shape: "square" }) as Record<string, unknown>;
        expect(def.shape).toBe("square");
    });

    it("shape 'circle' is stored in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, shape: "circle" }) as Record<string, unknown>;
        expect(def.shape).toBe("circle");
    });

    it("plain-string initials are stored in mapConfig result", () => {
        const def = reg.mapConfig({ ...base, initials: "JD" }) as Record<string, unknown>;
        expect(def.initials).toBe("JD");
    });

    it("alt field is NOT emitted by mapConfig (removed in P93)", () => {
        const def = reg.mapConfig({ ...base, alt: "some alt text" }) as Record<string, unknown>;
        expect(def).not.toHaveProperty("alt");
    });
});

// ── serializer tests ────────────────────────────────────────────────────────

describe("P93: ui-avatar — serializer", () => {
    function makeAvatar(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            id: "avatar1",
            kind: "avatar",
            mount: "route:/main/content",
            order: undefined,
            bind: {},
            props: { ...overrides },
            value: undefined,
            events: []
        };
    }

    // Bug 1: size → rendered via data-size attribute (sl-avatar has no native size attr)
    it("size 'md' → sl-avatar has a data-size='md' attribute", () => {
        const html = renderComponentHtml(makeAvatar({ size: "md" }), "main", {});
        expect(html).toContain("data-size=\"md\"");
    });

    it("size 'sm' → sl-avatar has a data-size='sm' attribute", () => {
        const html = renderComponentHtml(makeAvatar({ size: "sm" }), "main", {});
        expect(html).toContain("data-size=\"sm\"");
    });

    it("size 'lg' → sl-avatar has a data-size='lg' attribute", () => {
        const html = renderComponentHtml(makeAvatar({ size: "lg" }), "main", {});
        expect(html).toContain("data-size=\"lg\"");
    });

    it("size absent → no data-size attribute on sl-avatar", () => {
        const html = renderComponentHtml(makeAvatar(), "main", {});
        expect(html).not.toContain("data-size=");
    });

    // Bug 2: shape → rendered as shape attribute on sl-avatar
    it("shape 'square' → sl-avatar has shape='square'", () => {
        const html = renderComponentHtml(makeAvatar({ shape: "square" }), "main", {});
        expect(html).toContain("shape=\"square\"");
    });

    it("shape 'circle' → sl-avatar has shape='circle' or no shape attr (default)", () => {
        const html = renderComponentHtml(makeAvatar({ shape: "circle" }), "main", {});
        // circle is the sl-avatar default; must not render square
        expect(html).not.toContain("shape=\"square\"");
    });

    it("shape absent → no shape='square' on sl-avatar", () => {
        const html = renderComponentHtml(makeAvatar(), "main", {});
        expect(html).not.toContain("shape=\"square\"");
    });

    // Bug 3: initials → rendered as initials="..." on sl-avatar (not "[object Object]")
    it("initials 'JD' → sl-avatar has initials='JD'", () => {
        const html = renderComponentHtml(makeAvatar({ initials: "JD" }), "main", {});
        expect(html).toContain("initials=\"JD\"");
    });

    it("initials 'AB' → sl-avatar has initials='AB'", () => {
        const html = renderComponentHtml(makeAvatar({ initials: "AB" }), "main", {});
        expect(html).toContain("initials=\"AB\"");
    });

    it("initials absent → no initials attribute on sl-avatar", () => {
        const html = renderComponentHtml(makeAvatar(), "main", {});
        expect(html).not.toContain("initials=");
    });

    it("initials is not rendered as '[object Object]'", () => {
        const html = renderComponentHtml(makeAvatar({ initials: "TK" }), "main", {});
        expect(html).not.toContain("[object Object]");
    });

    // Bug 4: alt attribute removed — must not appear in serializer output
    it("alt attribute is NOT rendered on sl-avatar (removed in P93)", () => {
        const html = renderComponentHtml(makeAvatar({ alt: "user photo" }), "main", {});
        expect(html).not.toContain(" alt=");
    });

    // Renders a proper sl-avatar element
    it("renders sl-avatar element", () => {
        const html = renderComponentHtml(makeAvatar(), "main", {});
        expect(html).toContain("<sl-avatar");
    });

    // Combined: size + shape + initials all rendered correctly
    it("size 'sm' + shape 'square' + initials 'MR' all rendered", () => {
        const html = renderComponentHtml(makeAvatar({ size: "sm", shape: "square", initials: "MR" }), "main", {});
        expect(html).toContain("data-size=\"sm\"");
        expect(html).toContain("shape=\"square\"");
        expect(html).toContain("initials=\"MR\"");
    });
});
