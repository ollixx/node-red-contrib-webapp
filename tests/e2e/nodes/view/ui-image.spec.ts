import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-image (stateless view node).
 *
 * ui-image is a registered node type but is currently NOT included in the
 * component filter that populates the rendered snapshot (getDefinitionBuckets,
 * line ~1312 in nodes/webapp.js). It therefore produces no visible DOM output.
 * These specs verify the node does not crash the app when present in a flow.
 *
 * When ui-image is added to the components filter in a future phase, these
 * tests should be updated to assert on the rendered <img> or equivalent
 * Shoelace element.
 */

test.describe("ui-image (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("app with ui-image node deploys and serves (no crash)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp1", root: "imgApp1" })
            .route({ id: "imgRoute1", path: "/" })
            .node("ui-image", { id: "imgNode1", src: "https://example.com/photo.jpg", alt: "Photo" })
            .build();

        await deployFlow(request, flow);

        // The app must serve a 200 — the node not rendering is acceptable at
        // this phase, but it must not crash the server.
        const res = await request.get("/webapp/imgApp1/");
        expect(res.ok()).toBeTruthy();
    });

    test("app with ui-image renders root without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp2", root: "imgApp2" })
            .route({ id: "imgRoute2", path: "/" })
            .node("ui-image", { id: "imgNode2", src: "https://example.com/avatar.png" })
            .node("ui-text", { id: "imgText2", text: "Caption" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "imgApp2");
        await webapp.navigate("/");
        // ui-image is not yet in the component filter — only the text node renders.
        await expect(webapp.root()).toContainText("Caption");
    });

    test("ui-image with fallbackSrc — app still serves without error", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "imgApp3", root: "imgApp3" })
            .route({ id: "imgRoute3", path: "/" })
            .node("ui-image", {
                id: "imgNode3",
                src: "https://example.com/broken.jpg",
                fallback: "https://example.com/placeholder.png"
            })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/imgApp3/");
        expect(res.ok()).toBeTruthy();
    });
});
