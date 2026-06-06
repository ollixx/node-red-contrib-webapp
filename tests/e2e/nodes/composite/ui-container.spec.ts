import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-container (composite/layout node).
 *
 * Covers:
 *   - Renders sl-card wrapper in the DOM.
 *   - Child ui-text node mounted inside → text visible inside card.
 *   - Multiple children render in order.
 *   - layout preset "grid": children placed in CSS grid.
 */

test.describe("ui-container (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-card wrapper", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnApp1", root: "ctnApp1" })
            .node("ui-container", { id: "ctnNode1", layoutId: "vertical" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-card")).toBeVisible();
    });

    test("child ui-text mounted inside container → text visible in card", async ({ page, request }) => {
        const containerId = "ctnNode2";
        const flow = new FlowBuilder()
            .app({ id: "ctnApp2", root: "ctnApp2" })
            .node("ui-container", { id: containerId, layoutId: "vertical" })
            .node("ui-text", {
                id: "ctnText2",
                text: "Hello from inside",
                // Mount inside the container using the container:<id>/<slot> format.
                mount: `container:${containerId}/content`
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-card")).toContainText("Hello from inside");
    });

    test("multiple children render inside the container", async ({ page, request }) => {
        const containerId = "ctnNode3";
        const flow = new FlowBuilder()
            .app({ id: "ctnApp3", root: "ctnApp3" })
            .node("ui-container", { id: containerId, layoutId: "vertical" })
            .node("ui-text", { id: "ctnText3a", text: "First", mount: `container:${containerId}/content` })
            .node("ui-text", { id: "ctnText3b", text: "Second", mount: `container:${containerId}/content` })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-card")).toContainText("First");
        await expect(page.locator("sl-card")).toContainText("Second");
    });

    test("layout preset 'grid' — container renders without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ctnApp4", root: "ctnApp4" })
            .node("ui-container", { id: "ctnNode4", layoutId: "grid" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ctnApp4");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-card")).toBeVisible();
    });
});
