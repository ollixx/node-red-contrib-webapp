import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P96 — ui-button render-pipeline outcome tests.
 *
 * Verifies the complete serializer path for ui-button. Each test is
 * outcome-based: it turns RED if the feature is removed or broken.
 * Tests are written fresh per .ai/agents/node-testing.md.
 *
 * Scope: the serializer (webapp-serializer.js) is the last step in the
 * render pipeline and directly produces the HTML sent to the client.
 * These tests confirm that kind="button" components produce the correct
 * Shoelace markup for all fields documented in docs/nodes/display/ui-button.md.
 *
 * P96 context: the phase found that the render pipeline was already correct
 * for ui-button (components-filter, P16X_KIND_MAP, componentKindSchema,
 * renderer.ts, and serializer all handle "button" consistently). These tests
 * LOCK that correctness in so a future regression is caught immediately.
 *
 * Path note: createRequire(import.meta.url) resolves modules from this file's
 * actual on-disk path. The serializer path is absolute (computed from __dirname)
 * so the test runs identically in the worktree and in the main checkout.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);

// Compute path to the serializer from this file's on-disk location.
// This file lives at packages/runtime/test/ inside either the main checkout
// or a worktree. In both cases, ../../../resources/lib/ resolves correctly
// because resources/ lives at the repo root (in the worktree it is copied).
const _dir = path.dirname(fileURLToPath(import.meta.url));
const serializerPath = path.resolve(_dir, "../../../resources/lib/webapp-serializer.js");

const serializer = require(serializerPath) as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const ctx = { appId: "app1", location: "/" };

/** Build a minimal rendered-button component (what the renderer passes to the serializer). */
function buttonComponent(overrides: Record<string, unknown> = {}): unknown {
    return {
        kind: "button",
        id: "btn1",
        label: "Click me",
        mount: "app1.content",
        props: { label: "Click me" },
        events: [{ event: "click", action: "btn1" }],
        disabled: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// 1. Core render pipeline — sl-button with label (the "renders NOTHING" regression guard)
// ---------------------------------------------------------------------------

describe("P96: ui-button core render — sl-button with label in DOM", () => {
    it("kind='button' → renders <sl-button> (not undefined/empty)", () => {
        const html = serializer.renderComponentHtml(buttonComponent(), "vertical", ctx);
        expect(html).toContain("<sl-button");
    });

    it("label text appears inside sl-button as the default slot", () => {
        const html = serializer.renderComponentHtml(buttonComponent({ label: "Submit" }), "vertical", ctx);
        // The label must be inside the tag, not just an attribute.
        expect(html).toContain(">Submit<");
    });

    it("label is HTML-escaped (no XSS via label text)", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ label: '<b onclick="xss()">Click</b>' }),
            "vertical",
            ctx
        );
        expect(html).not.toContain("<b ");
        expect(html).toContain("&lt;b");
    });

    it("an enabled button is always an event source (data-webapp-source + data-webapp-event)", () => {
        const html = serializer.renderComponentHtml(buttonComponent(), "vertical", ctx);
        expect(html).toContain("data-webapp-source=");
        expect(html).toContain('data-webapp-event="click"');
    });

    it("event source id matches the component id", () => {
        const html = serializer.renderComponentHtml(buttonComponent({ id: "myBtn" }), "vertical", ctx);
        expect(html).toContain('data-webapp-source="myBtn"');
    });
});

// ---------------------------------------------------------------------------
// 2. Variant serialization
// ---------------------------------------------------------------------------

describe("P96: ui-button variant serialization", () => {
    it("variant='primary' → sl-button[variant=primary]", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", variant: "primary" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('variant="primary"');
    });

    it("variant='danger' → sl-button[variant=danger]", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", variant: "danger" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('variant="danger"');
    });

    it("variant='ghost' → sl-button[variant=default] (ghost maps to Shoelace default)", () => {
        // Shoelace has no native 'ghost'; the adapter maps it to "default" (many-to-one ok per ADR-0002).
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", variant: "ghost" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('variant="default"');
    });

    it("no variant → sl-button[variant=default] (Shoelace default fallback)", () => {
        const html = serializer.renderComponentHtml(buttonComponent(), "vertical", ctx);
        // mapVariant always emits a variant; unset → "default" (documented Shoelace default).
        expect(html).toContain('variant="default"');
    });
});

// ---------------------------------------------------------------------------
// 3. Size serialization (sm/md/lg → small/medium/large)
// ---------------------------------------------------------------------------

describe("P96: ui-button size serialization", () => {
    it("size='sm' → size='small' on sl-button", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", size: "sm" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('size="small"');
    });

    it("size='md' → size='medium' on sl-button", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", size: "md" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('size="medium"');
    });

    it("size='lg' → size='large' on sl-button", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", size: "lg" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('size="large"');
    });

    it("no size → no size attribute on sl-button", () => {
        const html = serializer.renderComponentHtml(buttonComponent(), "vertical", ctx);
        expect(html).not.toMatch(/\bsize="/);
    });
});

// ---------------------------------------------------------------------------
// 4. Outline flag
// ---------------------------------------------------------------------------

describe("P96: ui-button outline serialization", () => {
    it("outline=true → outline boolean attribute present", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", outline: true } }),
            "vertical",
            ctx
        );
        expect(html).toMatch(/<sl-button[^>]*\soutline(\s|>)/);
    });

    it("outline=false → no outline attribute", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", outline: false } }),
            "vertical",
            ctx
        );
        expect(html).not.toMatch(/\boutline(\s|>)/);
    });

    it("outline absent → no outline attribute", () => {
        const html = serializer.renderComponentHtml(buttonComponent(), "vertical", ctx);
        expect(html).not.toMatch(/\boutline(\s|>)/);
    });
});

// ---------------------------------------------------------------------------
// 5. Disabled rendering
// ---------------------------------------------------------------------------

describe("P96: ui-button disabled serialization", () => {
    it("disabled=true → sl-button[disabled] attribute + NOT an event source", () => {
        const html = serializer.renderComponentHtml(buttonComponent({ disabled: true }), "vertical", ctx);
        expect(html).toContain(" disabled");
        // A disabled button must NOT fire click events.
        expect(html).not.toContain("data-webapp-event");
    });

    it("disabled=false → no disabled attribute, still an event source", () => {
        const html = serializer.renderComponentHtml(buttonComponent({ disabled: false }), "vertical", ctx);
        expect(html).not.toContain(" disabled");
        expect(html).toContain("data-webapp-event");
    });
});

// ---------------------------------------------------------------------------
// 6. Link-mode serialization
// ---------------------------------------------------------------------------

describe("P96: ui-button link mode serialization", () => {
    it('default "button" mode → no href, click-dispatch event source', () => {
        const html = serializer.renderComponentHtml(buttonComponent(), "vertical", ctx);
        expect(html).toContain("data-webapp-source");
        expect(html).toContain("data-webapp-event");
        expect(html).not.toContain("href=");
    });

    it('"url" mode with href → sl-button[href] renders a real hyperlink, not a click source', () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Docs", linkMode: "url", href: "https://example.com/docs" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('href="https://example.com/docs"');
        // A URL-mode button navigates the browser — it does NOT dispatch a click event.
        expect(html).not.toContain("data-webapp-event");
    });

    it('"url" mode href is HTML-escaped (no attribute injection)', () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Link", linkMode: "url", href: 'http://x"><script>y' } }),
            "vertical",
            ctx
        );
        expect(html).not.toContain("<script>");
        expect(html).not.toContain('"><script>');
    });

    it('"navigate" mode → data-webapp-navigate carries route AND is still a click source', () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { label: "Go", linkMode: "navigate", href: "/customers" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('data-webapp-navigate="/customers"');
        // navigate-mode still reports the click to the flow.
        expect(html).toContain("data-webapp-source");
        expect(html).toContain("data-webapp-event");
    });
});

// ---------------------------------------------------------------------------
// 7. Icon prefix slot
// ---------------------------------------------------------------------------

describe("P96: ui-button icon prefix slot serialization", () => {
    it("icon {library,name} → sl-icon[slot=prefix] rendered before the label", () => {
        const html = serializer.renderComponentHtml(
            // label at top level (serializer reads component.label); props.icon for the icon
            buttonComponent({ label: "Save", props: { label: "Save", icon: { library: "default", name: "check" } } }),
            "vertical",
            ctx
        );
        // The icon must be in the prefix slot.
        expect(html).toContain('slot="prefix"');
        // The label text must still appear.
        expect(html).toContain("Save");
    });

    it("icon renders as sl-icon with name attribute", () => {
        const html = serializer.renderComponentHtml(
            buttonComponent({ props: { icon: { library: "default", name: "star" } } }),
            "vertical",
            ctx
        );
        expect(html).toMatch(/sl-icon[^>]*name="star"/);
    });

    it("no icon → no prefix slot in output", () => {
        const html = serializer.renderComponentHtml(buttonComponent(), "vertical", ctx);
        expect(html).not.toContain('slot="prefix"');
    });
});
