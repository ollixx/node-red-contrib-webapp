import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-breadcrumb (stateless view node).
 *
 * Covers:
 *   1. Renders the correct Shoelace element (sl-breadcrumb).
 *   2. items array → correct number of <sl-breadcrumb-item> elements.
 *   3. Each breadcrumb item label renders as text content.
 *   4. Empty items array renders without crashing.
 *
 * Items must be passed as an actual array of objects (not a JSON string).
 * The mapConfig fix in P43 ensures Array.isArray(config.items) is checked
 * before parseList, so static item arrays survive the validation chain.
 */

test.describe("ui-breadcrumb (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-breadcrumb element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcApp1", root: "bcApp1" })
            .node("ui-breadcrumb", {
                id: "bcNode1",
                items: [{ label: "Home" }, { label: "Products" }]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-breadcrumb")).toBeVisible();
    });

    test("items array — correct number of sl-breadcrumb-item elements", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcApp2", root: "bcApp2" })
            .node("ui-breadcrumb", {
                id: "bcNode2",
                items: [
                    { label: "Home" },
                    { label: "Customers" },
                    { label: "Details" }
                ]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-breadcrumb-item")).toHaveCount(3);
    });

    test("breadcrumb item labels render as text content", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcApp3", root: "bcApp3" })
            .node("ui-breadcrumb", {
                id: "bcNode3",
                items: [{ label: "Start" }, { label: "Middle" }, { label: "End" }]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-breadcrumb")).toContainText("Start");
        await expect(page.locator("sl-breadcrumb")).toContainText("Middle");
        await expect(page.locator("sl-breadcrumb")).toContainText("End");
    });

    // P75 — clicking a navigable breadcrumb item (one with `path`, not the last)
    // dispatches a `navigate` event to the node's output port with params.path.
    test("click on a navigable item POSTs /event { event:'navigate', params:{ path } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcNav1", root: "bcNav1" })
            .node("ui-breadcrumb", {
                id: "bcNavNode1",
                items: [
                    { label: "Home", path: "/" },
                    { label: "Customers", path: "/customers" },
                    { label: "Details" }
                ]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcNav1");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        // Click the first navigable item (Home → "/").
        await page.locator("sl-breadcrumb-item[data-webapp-navigate-path]").first().click();

        const body = await eventPromise;
        expect(body.event).toBe("navigate");
        expect(body.sourceId).toBe("bcNavNode1");
        expect((body.params as Record<string, unknown>).path).toBe("/");
    });

    test("empty items array renders without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcApp4", root: "bcApp4" })
            .node("ui-breadcrumb", {
                id: "bcNode4",
                items: []
            })
            .node("ui-text", { id: "bcText4", text: "Sibling" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcApp4");
        await webapp.navigate("/");
        // The app must serve and render siblings without crashing.
        // An empty sl-breadcrumb may be hidden by Shoelace; the sibling text
        // confirms the layout renders.
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-breadcrumb")).toHaveCount(1);
    });
});
