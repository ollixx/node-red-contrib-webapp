import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P99 — ui-image fresh E2E tests (per .ai/agents/node-testing.md).
 * Replaces the P70 presence-only E2E tests.
 *
 * Each test asserts an observable OUTCOME (rendered attribute / DOM structure).
 * A test turns RED if the feature is removed or broken.
 *
 * Covers (see docs/nodes/display/ui-image.md):
 *   - Render pipeline: <img> present with src attribute (regression guard)
 *   - Alt text: alt attribute rendered correctly
 *   - Dimensions: width/height as CSS values in style
 *   - Fit: object-fit in style attribute
 *   - Fallback src: onerror attribute present
 *   - msg.payload update: src updated via inject message
 *   - Asset proxy: asset:<id> rewritten to backend proxy URL
 *   - Asset proxy security: path-traversal rejected, missing store → 404
 *
 * show/hide verbs are covered by the cross-cutting ui-action-verbs.spec.ts.
 * payloadToImageSrc (Buffer→data:) is covered by packages/runtime/test/p70-image-payload.test.ts.
 *
 * See: tests/e2e/nodes/view/ui-image.tests.md
 */

test.describe("ui-image (P99)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── Core render pipeline ─────────────────────────────────────────────────

    test("renders a native <img> with src — regression guard", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp1", root: "imgApp1" })
            .node("ui-image", {
                id: "imgNode1",
                src: { kind: "literal", value: "https://example.com/photo.jpg" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "imgApp1");
        await webapp.navigate("/");
        // Outcome: an <img> element is in the DOM with the correct src.
        const img = webapp.root().locator("img").first();
        await expect(img).toHaveCount(1);
        await expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
    });

    test("HTML source contains <img> with src — server-render check", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp2", root: "imgApp2" })
            .node("ui-image", {
                id: "imgNode2",
                src: { kind: "literal", value: "https://example.com/image.png" }
            })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp2/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toContain("<img");
        expect(html).toContain('src="https://example.com/image.png"');
    });

    // ── Alt text ─────────────────────────────────────────────────────────────

    test("alt text appears as the alt attribute on <img>", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp3", root: "imgApp3" })
            .node("ui-image", {
                id: "imgNode3",
                src: { kind: "literal", value: "https://example.com/product.jpg" },
                alt: "Product photo"
            })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp3/");
        const html = await res.text();
        expect(html).toContain('alt="Product photo"');
    });

    // ── Dimensions and fit ───────────────────────────────────────────────────

    test("width, height and fit appear in style attribute", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp4", root: "imgApp4" })
            .node("ui-image", {
                id: "imgNode4",
                src: { kind: "literal", value: "https://example.com/photo.jpg" },
                fit: "cover",
                width: "100%",
                height: 150
            })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp4/");
        const html = await res.text();
        expect(html).toContain("object-fit: cover");
        expect(html).toContain("width: 100%");
        expect(html).toContain("height: 150px");
    });

    test("integer width → px value in style (not raw number)", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp5", root: "imgApp5" })
            .node("ui-image", {
                id: "imgNode5",
                src: { kind: "literal", value: "https://example.com/photo.jpg" },
                width: 200
            })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp5/");
        const html = await res.text();
        expect(html).toContain("width: 200px");
    });

    // ── Fallback src ─────────────────────────────────────────────────────────

    test("fallback field → onerror attribute present in rendered <img>", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp6", root: "imgApp6" })
            .node("ui-image", {
                id: "imgNode6",
                src: { kind: "literal", value: "https://example.com/photo.jpg" },
                // mapConfig reads config.fallback → fallbackSrc
                fallback: "https://example.com/placeholder.png"
            })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp6/");
        const html = await res.text();
        expect(html).toContain("onerror=");
        expect(html).toContain("https://example.com/placeholder.png");
    });

    // ── msg.payload update ───────────────────────────────────────────────────

    test("msg.payload string → src updated in DOM after inject", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp7", root: "imgApp7" })
            .node("ui-image", {
                id: "imgNode7",
                src: { kind: "literal", value: "https://example.com/before.jpg" }
            })
            .withInjectNode("inj7", "imgNode7", "https://example.com/after.jpg")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "imgApp7");
        await webapp.navigate("/");

        // Before inject: original src
        await expect(webapp.root().locator("img")).toHaveAttribute(
            "src",
            "https://example.com/before.jpg"
        );

        // Inject a new URL
        await injectMessage(request, "inj7");
        await page.waitForTimeout(300);

        // After inject: src updated
        await expect(webapp.root().locator("img")).toHaveAttribute(
            "src",
            "https://example.com/after.jpg"
        );
    });

    // ── Asset proxy ──────────────────────────────────────────────────────────

    test("asset:<id> src is rewritten to backend proxy; real store URL is hidden", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp8", root: "imgApp8", mediaStoreUrl: "https://store.internal/secret" })
            .node("ui-image", { id: "imgNode8", src: { kind: "literal", value: "asset:logo-2024" } })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp8/");
        const html = await res.text();
        // Proxy URL present, real store URL absent
        expect(html).toContain("/webapp/imgApp8/asset/logo-2024");
        expect(html).not.toContain("store.internal");
        expect(html).not.toContain("secret");
    });

    test("asset proxy returns 404 when no media store is configured", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp9", root: "imgApp9" })
            .node("ui-image", { id: "imgNode9", src: { kind: "literal", value: "asset:x" } })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp9/asset/x");
        expect(res.status()).toBe(404);
    });

    test("asset proxy rejects path-traversal id with 400 or 404", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp10", root: "imgApp10", mediaStoreUrl: "https://store.internal/media" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp10/asset/..%2f..%2fetc%2fpasswd");
        expect([400, 404]).toContain(res.status());
    });
});
