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
});
