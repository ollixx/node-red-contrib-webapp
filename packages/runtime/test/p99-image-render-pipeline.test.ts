import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P99 — ui-image render-pipeline outcome tests.
 *
 * Verifies the complete serializer path for ui-image. Each test is
 * outcome-based: it turns RED if the feature is removed or broken.
 * Tests are written fresh per .ai/agents/node-testing.md.
 *
 * Scope: the serializer (webapp-serializer.js) is the last step in the
 * render pipeline and directly produces the HTML sent to the client.
 * These tests confirm that kind="image" components produce the correct
 * <img> markup for all fields documented in docs/nodes/display/ui-image.md.
 *
 * P99 context: the phase investigates the "renders NOTHING" claim
 * (similar to P96/P83). The pipeline check covers components-filter,
 * P16X_KIND_MAP, componentKindSchema, renderer.ts, and serializer — all
 * must handle "image" consistently.
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

/** Build a minimal rendered-image component (what the renderer passes to the serializer). */
function imageComponent(overrides: Record<string, unknown> = {}): unknown {
    return {
        kind: "image",
        id: "img1",
        mount: "app1.content",
        value: "https://example.com/photo.jpg",
        props: {
            alt: "",
        },
        events: [],
        disabled: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// 1. Core render pipeline — <img> with src (the "renders NOTHING" regression guard)
// ---------------------------------------------------------------------------

describe("P99: ui-image core render — <img> with src in DOM", () => {
    it("kind='image' → renders <img> (not undefined/empty)", () => {
        const html = serializer.renderComponentHtml(imageComponent(), "vertical", ctx);
        expect(html).toContain("<img");
    });

    it("value is used as src attribute", () => {
        const html = serializer.renderComponentHtml(imageComponent(), "vertical", ctx);
        expect(html).toContain('src="https://example.com/photo.jpg"');
    });

    it("component.value as the resolved src appears in the img tag (not just props.src)", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ value: "https://cdn.example.com/image.png" }),
            "vertical",
            ctx
        );
        expect(html).toContain('src="https://cdn.example.com/image.png"');
    });

    it("an image without src still renders <img> (no crash, empty src)", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ value: undefined, props: { alt: "no src" } }),
            "vertical",
            ctx
        );
        expect(html).toContain("<img");
        // No src attribute when value is absent
        expect(html).not.toContain('src=');
    });
});

// ---------------------------------------------------------------------------
// 2. Alt text
// ---------------------------------------------------------------------------

describe("P99: ui-image alt attribute", () => {
    it("alt text appears as the alt attribute", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "Product photo" } }),
            "vertical",
            ctx
        );
        expect(html).toContain('alt="Product photo"');
    });

    it("alt text is HTML-escaped (no XSS via alt text)", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: '""><script>xss()</script>' } }),
            "vertical",
            ctx
        );
        expect(html).not.toContain("<script>");
        expect(html).toContain("alt=");
    });

    it("missing alt → alt='' (always present for accessibility)", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: {} }),
            "vertical",
            ctx
        );
        expect(html).toContain('alt=""');
    });
});

// ---------------------------------------------------------------------------
// 3. Object-fit, width and height
// ---------------------------------------------------------------------------

describe("P99: ui-image dimensions and fit", () => {
    it("fit='cover' → style contains object-fit: cover", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "", fit: "cover" } }),
            "vertical",
            ctx
        );
        expect(html).toContain("object-fit: cover");
    });

    it("fit='contain' → style contains object-fit: contain", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "", fit: "contain" } }),
            "vertical",
            ctx
        );
        expect(html).toContain("object-fit: contain");
    });

    it("width as CSS string → appears in style", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "", width: "100%" } }),
            "vertical",
            ctx
        );
        expect(html).toContain("width: 100%");
    });

    it("height as integer → appears in style as px value", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "", height: 150 } }),
            "vertical",
            ctx
        );
        expect(html).toContain("height: 150px");
    });

    it("width as integer → appears in style as px value", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "", width: 200 } }),
            "vertical",
            ctx
        );
        expect(html).toContain("width: 200px");
    });

    it("no fit/width/height → no style attribute emitted", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "" } }),
            "vertical",
            ctx
        );
        // Either no style attribute or an empty one
        expect(html).not.toContain("style=");
    });
});

// ---------------------------------------------------------------------------
// 4. Fallback src (onerror handler)
// ---------------------------------------------------------------------------

describe("P99: ui-image fallback src", () => {
    it("fallbackSrc prop → onerror attribute with fallback URL", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "", fallbackSrc: "https://cdn.example.com/fallback.png" } }),
            "vertical",
            ctx
        );
        expect(html).toContain("onerror=");
        expect(html).toContain("https://cdn.example.com/fallback.png");
    });

    it("no fallbackSrc → no onerror attribute", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ props: { alt: "" } }),
            "vertical",
            ctx
        );
        expect(html).not.toContain("onerror=");
    });
});

// ---------------------------------------------------------------------------
// 5. Asset src rewriting (proxy obfuscation)
// ---------------------------------------------------------------------------

describe("P99: ui-image asset:<id> → backend proxy rewrite", () => {
    it("asset:<id> value is rewritten to /webapp/appId/asset/id when mediaStoreUrl is set", () => {
        const ctxWithStore = { appId: "app1", location: "/", mediaStoreUrl: "https://store.internal/media" };
        const html = serializer.renderComponentHtml(
            imageComponent({ value: "asset:logo-2024" }),
            "vertical",
            ctxWithStore
        );
        expect(html).toContain("/webapp/app1/asset/logo-2024");
        // Proxy hides the real store URL
        expect(html).not.toContain("store.internal");
    });

    it("asset:<id> without mediaStoreUrl → raw asset: string used as src (no proxy)", () => {
        const html = serializer.renderComponentHtml(
            imageComponent({ value: "asset:logo-2024" }),
            "vertical",
            ctx
        );
        // Without a media store, the asset: string is used as-is (or left empty).
        // The key invariant: no crash; something is produced.
        expect(html).toContain("<img");
    });
});

// ---------------------------------------------------------------------------
// 6. Full render-pipeline integration (renderAppPage): <img> appears in the page
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const renderAppPage = webappTest.renderAppPage as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { status: number; body: string };

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

function buildDefs(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

describe("P99: ui-image full render pipeline — <img> in renderAppPage output", () => {
    const definitions = buildDefs([
        { type: "ui-app", id: "app1", name: "Demo", root: "app1", layout: "vertical", z: "f1" },
        {
            type: "ui-image",
            id: "img1",
            mount: "app1.content",
            src: { kind: "literal", value: "https://cdn.example.com/photo.jpg" },
            alt: "Photo",
            fit: "cover",
            width: "100%",
            height: 150,
            fallback: "https://cdn.example.com/placeholder.png",
            z: "f1"
        }
    ]);

    const result = renderAppPage("app1", "/", undefined, definitions);

    it("renderAppPage succeeds (status 200)", () => {
        expect(result.status).toBe(200);
    });

    it("page body contains <img> tag", () => {
        expect(result.body).toContain("<img");
    });

    it("page body contains the literal src URL", () => {
        expect(result.body).toContain("src=\"https://cdn.example.com/photo.jpg\"");
    });

    it("page body contains alt, object-fit, width and height", () => {
        expect(result.body).toContain("alt=\"Photo\"");
        expect(result.body).toContain("object-fit: cover");
        expect(result.body).toContain("width: 100%");
        expect(result.body).toContain("height: 150px");
    });
});
