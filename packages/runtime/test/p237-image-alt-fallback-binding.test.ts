import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * P237 — binding-doc-drift sweep (Muster 4).
 *
 * `ui-image.alt` and `ui-image.fallbackSrc` are schema- and editor-bindable
 * (P151, ADR 0012), yet their spec documented them as static "Textfeld" — and
 * fallbackSrc even claimed "Kein Binding". These tests prove the full render
 * pipeline (renderer → serializer): a `state`-BOUND alt is RESOLVED into the
 * `<img alt>` attribute, and a `state`-BOUND fallbackSrc into the `onerror`
 * fallback URL — with the resolved values, NOT the literal path strings. Turn
 * RED if the renderer stops resolving either binding.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const require = createRequire(import.meta.url);
const _dir = path.dirname(fileURLToPath(import.meta.url));
const serializerPath = path.resolve(_dir, "../../../resources/lib/webapp-serializer.js");
const rendererPath = path.resolve(_dir, "../../renderer/dist/index.js");

const serializer = require(serializerPath) as {
    renderComponentHtml: (component: unknown, layoutId: string, ctx: unknown) => string;
};

const { createRendererApp, findComponentInSnapshot } = require(rendererPath) as {
    createRendererApp: (model: unknown, options: unknown) => { render: () => unknown };
    findComponentInSnapshot: (snapshot: unknown, id: string) => unknown;
};

const NO_INTEGRATION = { stores: [], queries: [], actions: [], navigations: [] };
const CTX = { appId: "app1", location: "/" };

function renderImage(state: Record<string, unknown>): string {
    const model = {
        id: "app",
        name: "App",
        layouts: [{ id: "main", slots: [{ name: "content" }] }],
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components: [
            {
                id: "im1",
                kind: "image",
                mount: "route:/home/content",
                order: 0,
                bind: {
                    alt: { kind: "state", path: "form.altText" },
                    fallbackSrc: { kind: "state", path: "form.fb" },
                    value: { kind: "literal", value: "https://example.com/a.png" }
                },
                props: { src: "https://example.com/a.png" },
                events: []
            }
        ]
    };
    const app = createRendererApp(model, { integration: NO_INTEGRATION, state });
    const rendered = findComponentInSnapshot(app.render(), "im1");
    return serializer.renderComponentHtml(rendered, "content", CTX);
}

describe("P237: ui-image.alt — state binding resolved + rendered", () => {
    it("a state-bound alt is resolved and rendered as the <img> alt attribute", () => {
        const html = renderImage({ form: { altText: "Company logo", fb: "https://example.com/fallback.png" } });
        expect(html).toContain("<img");
        expect(html).toContain('alt="Company logo"');
    });

    it("the raw alt binding path string never leaks into the rendered attribute", () => {
        const html = renderImage({ form: { altText: "Company logo", fb: "https://example.com/fallback.png" } });
        expect(html).not.toContain("form.altText");
        expect(html).not.toContain("[object Object]");
    });
});

describe("P237: ui-image.fallbackSrc — state binding resolved + rendered", () => {
    it("a state-bound fallbackSrc is resolved and carried into the onerror fallback URL", () => {
        const html = renderImage({ form: { altText: "Company logo", fb: "https://example.com/fallback.png" } });
        expect(html).toContain("onerror=");
        expect(html).toContain("this.src='https://example.com/fallback.png'");
    });

    it("the raw fallbackSrc binding path string never leaks into the onerror handler", () => {
        const html = renderImage({ form: { altText: "Company logo", fb: "https://example.com/fallback.png" } });
        expect(html).not.toContain("form.fb");
    });
});
