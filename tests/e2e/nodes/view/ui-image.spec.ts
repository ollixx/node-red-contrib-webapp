import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P70 — ui-image now renders as a native <img> (it was previously excluded from
 * the component filter). These specs verify:
 *   - a literal URL src renders an <img> with the URL, alt, object-fit and dims,
 *   - an `asset:<id>` src is rewritten to the app-scoped backend proxy URL and
 *     the real mediaStoreUrl is never present in the served HTML (obfuscation),
 *   - the asset proxy endpoint guards against missing store / bad ids.
 */

test.describe("ui-image render (P70)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders a native <img> with literal URL, alt, fit and dimensions", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp1", root: "imgApp1" })
            .node("ui-image", {
                id: "imgNode1",
                src: { kind: "literal", value: "https://example.com/photo.jpg" },
                alt: "Photo",
                fit: "cover",
                width: "100%",
                height: 150
            })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp1/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toContain("<img");
        expect(html).toContain("src=\"https://example.com/photo.jpg\"");
        expect(html).toContain("alt=\"Photo\"");
        expect(html).toContain("object-fit: cover");
        expect(html).toContain("width: 100%");
        expect(html).toContain("height: 150px");

        const webapp = new WebappPage(page, "imgApp1");
        await webapp.navigate("/");
        await expect(webapp.root().locator("img")).toHaveCount(1);
    });

    test("rewrites asset:<id> to the backend proxy; the store URL stays hidden", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp2", root: "imgApp2", mediaStoreUrl: "https://store.internal/secret-media" })
            .node("ui-image", { id: "imgNode2", src: { kind: "literal", value: "asset:logo-2024" } })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp2/");
        const html = await res.text();
        expect(html).toContain("/webapp/imgApp2/asset/logo-2024");
        // Obfuscation: the real store URL must never appear in the served page.
        expect(html).not.toContain("store.internal");
        expect(html).not.toContain("secret-media");
    });

    test("the asset proxy returns 404 when no media store is configured", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp3", root: "imgApp3" })
            .node("ui-image", { id: "imgNode3", src: { kind: "literal", value: "asset:x" } })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp3/asset/x");
        expect(res.status()).toBe(404);
    });

    test("the asset proxy rejects a path-traversal id with 400", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp4", root: "imgApp4", mediaStoreUrl: "https://store.internal/media" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp4/asset/..%2f..%2fetc%2fpasswd");
        expect([400, 404]).toContain(res.status());
    });
});
