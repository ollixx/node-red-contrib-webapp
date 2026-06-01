import { expect, test } from "@playwright/test";

/**
 * P21 — webapp.js renders the customers-crud example exclusively from the
 * RenderSnapshot produced by packages/renderer. This drives the snapshot-based
 * HTML output directly (routes, dialog, table rows) via the live transport.
 *
 * Note (P32): the /reset and /snapshot endpoints were removed. The dialog is
 * now opened via the ?dialog=<id> query parameter on the initial page load.
 */
test.describe("P21: snapshot-driven rendering", () => {
    test("renders the customers route (table present, node-driven structure)", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");

        await expect(page.locator("table.webapp-table")).toBeVisible();
    });

    test("renders the customer-detail route", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers/c-100");

        await expect(page.getByRole("link", { name: "Back to customers" })).toBeVisible();
        await expect(page.locator(".webapp-grid")).toContainText("c-100");
    });

    test("renders the dialog when ?dialog=<id> is in the URL", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers?dialog=customerEditor");

        await expect(page.locator(".webapp-dialog-card")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Edit customer" })).toBeVisible();
        // Dialog content (mounted via dialog:customerEditor/content) renders inside the card.
        await expect(page.locator(".webapp-dialog-card").getByRole("textbox", { name: "Name" })).toBeVisible();
    });

    test("does not surface internal slot names as visible headings", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");

        const headings = await page.locator("h2").allTextContents();
        const slotNames = headings.map((heading) => heading.trim().toLowerCase());

        expect(slotNames).not.toContain("header");
        expect(slotNames).not.toContain("navbar");
        expect(slotNames).not.toContain("content");
        expect(slotNames).not.toContain("footer");
    });
});
