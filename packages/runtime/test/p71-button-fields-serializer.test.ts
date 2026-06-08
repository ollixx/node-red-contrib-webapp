import { describe, expect, it } from "vitest";

/**
 * P71 — ui-button gains size, an explicit outline flag, and a link mode
 * (button | url | navigate) with a binding-capable href. The serializer:
 *   • emits the Shoelace size attribute (sm/md/lg → small/medium/large),
 *   • emits the boolean `outline` attribute when outline is true,
 *   • renders a real hyperlink (sl-button href → <a>) in "url" mode,
 *   • marks a "navigate" button with data-webapp-navigate carrying the route,
 *   • keeps the default "button" mode an event source (no href, click dispatch).
 * The label remains the button's default slot; an icon stays in the prefix slot.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serializer = require("../../../resources/lib/webapp-serializer.js") as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const ctx = { appId: "app1", location: "/" };

function button(props: Record<string, unknown>): unknown {
    return { kind: "button", id: "btn", label: String(props.label ?? "Go"), props: { label: "Go", ...props } };
}

describe("P71: ui-button size + outline serialization", () => {
    it("emits the Shoelace size attribute for a sm/md/lg size", () => {
        expect(serializer.renderComponentHtml(button({ size: "sm" }), "vertical", ctx)).toContain('size="small"');
        expect(serializer.renderComponentHtml(button({ size: "lg" }), "vertical", ctx)).toContain('size="large"');
    });

    it("emits the boolean outline attribute when outline is true", () => {
        const html = serializer.renderComponentHtml(button({ outline: true }), "vertical", ctx);
        expect(html).toMatch(/<sl-button[^>]*\soutline(\s|>)/);
    });

    it("does not emit outline when the flag is unset/false", () => {
        expect(serializer.renderComponentHtml(button({}), "vertical", ctx)).not.toMatch(/\soutline(\s|>)/);
        expect(serializer.renderComponentHtml(button({ outline: false }), "vertical", ctx)).not.toMatch(/\soutline(\s|>)/);
    });
});

describe("P71: ui-button link mode serialization", () => {
    it('default "button" mode stays an event source (no href, click dispatch attrs)', () => {
        const html = serializer.renderComponentHtml(button({}), "vertical", ctx);
        expect(html).toContain('data-webapp-source="btn"');
        expect(html).toContain('data-webapp-event="click"');
        expect(html).not.toContain("href=");
        expect(html).not.toContain("data-webapp-navigate");
    });

    it('"url" mode renders a real hyperlink via the sl-button href attribute', () => {
        const html = serializer.renderComponentHtml(
            button({ linkMode: "url", href: "https://example.com/docs" }),
            "vertical",
            ctx
        );
        expect(html).toContain('href="https://example.com/docs"');
        // A true link is not also a click-dispatch event source.
        expect(html).not.toContain('data-webapp-event="click"');
    });

    it('"url" mode reads a resolved href from props.href (renderer routes bind.href → resolvedProps.href)', () => {
        const html = serializer.renderComponentHtml(
            { kind: "button", id: "btn", label: "Go", props: { label: "Go", linkMode: "url", href: "https://bound.example" } },
            "vertical",
            ctx
        );
        expect(html).toContain('href="https://bound.example"');
    });

    it('"navigate" mode marks the button with data-webapp-navigate carrying the route', () => {
        const html = serializer.renderComponentHtml(
            button({ linkMode: "navigate", href: "/customers" }),
            "vertical",
            ctx
        );
        expect(html).toContain('data-webapp-navigate="/customers"');
        // Still a click-class trigger so the flow is informed of the click.
        expect(html).toContain('data-webapp-source="btn"');
    });

    it("escapes the href (no attribute-injection)", () => {
        const html = serializer.renderComponentHtml(
            button({ linkMode: "url", href: 'http://x"><script>y' }),
            "vertical",
            ctx
        );
        expect(html).not.toContain("<script>");
    });

    it("keeps the label as the default slot and the icon in the prefix slot", () => {
        const html = serializer.renderComponentHtml(
            button({ icon: { library: "default", name: "plus" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('slot="prefix"');
        expect(html).toContain("Go");
    });
});
