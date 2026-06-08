import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-menu (composite node).
 *
 * Covers:
 *   - Items array renders sl-menu with sl-menu-item elements.
 *   - Item labels are rendered correctly.
 *   - Menu with route items renders correct href attributes.
 */

test.describe("ui-menu (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("items render as sl-menu with sl-menu-item elements", async ({ page, request }) => {
        // Pass items as a JSON array string — parseJsonList handles it correctly.
        const items = JSON.stringify([
            { label: "Home", route: "/" },
            { label: "About", route: "/about" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "menuApp1", root: "menuApp1" })
            .node("ui-menu", { id: "menuNode1", items })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuApp1");
        await webapp.navigate("/");

        await expect(page.locator("sl-menu")).toBeVisible();
        const menuItems = page.locator("sl-menu sl-menu-item");
        await expect(menuItems).toHaveCount(2);
        await expect(menuItems.nth(0)).toContainText("Home");
        await expect(menuItems.nth(1)).toContainText("About");
    });

    test("item with route renders correctly with label text", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuApp2", root: "menuApp2" })
            .node("ui-menu", {
                id: "menuNode2",
                items: JSON.stringify([{ label: "Customers", route: "/customers" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuApp2");
        await webapp.navigate("/");

        // Verify the item renders with the correct label text.
        await expect(page.locator("sl-menu sl-menu-item").first()).toContainText("Customers");

        // Verify the rendered HTML contains the route href (via page source inspection).
        const html = await page.locator("sl-menu").innerHTML();
        expect(html).toContain("/customers");
    });

    test("item with explicit href renders in the page HTML", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuApp3", root: "menuApp3" })
            .node("ui-menu", {
                id: "menuNode3",
                items: JSON.stringify([{ label: "External", href: "https://example.com" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuApp3");
        await webapp.navigate("/");

        await expect(page.locator("sl-menu sl-menu-item").first()).toContainText("External");

        // The href should appear in the rendered HTML of the sl-menu element.
        const html = await page.locator("sl-menu").innerHTML();
        expect(html).toContain("https://example.com");
    });

    // P75 — clicking a route/path menu item dispatches a `navigate` event to the
    // node's output port with params.path. The client preventDefaults, so the
    // wired flow (not the browser) drives the route change.
    test("click on a route item POSTs /event { event:'navigate', params:{ path } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuNav1", root: "menuNav1" })
            .node("ui-menu", {
                id: "menuNavNode1",
                items: JSON.stringify([
                    { label: "Dashboard", route: "/dashboard" },
                    { label: "Customers", route: "/customers" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuNav1");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("sl-menu-item[data-webapp-navigate-path]").first().click();

        const body = await eventPromise;
        expect(body.event).toBe("navigate");
        expect(body.sourceId).toBe("menuNavNode1");
        expect((body.params as Record<string, unknown>).path).toBe("/dashboard");
    });

    // P75 — external href items must NOT carry the navigate hook (the browser
    // opens the link; no `navigate` event is emitted).
    test("external href item carries no navigate hook", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuNav2", root: "menuNav2" })
            .node("ui-menu", {
                id: "menuNavNode2",
                items: JSON.stringify([{ label: "External", href: "https://example.com" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuNav2");
        await webapp.navigate("/");

        await expect(page.locator("sl-menu-item[data-webapp-navigate-path]")).toHaveCount(0);
    });
});
