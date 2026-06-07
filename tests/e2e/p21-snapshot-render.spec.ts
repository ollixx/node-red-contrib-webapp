import { readFile } from "node:fs/promises";
import path from "node:path";

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
    // Restore the customers-crud baseline after this spec so subsequent specs
    // that depend on customersApp start from a known-good state. The tests here
    // do not change the deployed flow, but they open SSE connections that may
    // not be fully closed before the next spec's beforeEach deploy fires.
    test.afterAll(async ({ request }) => {
        const fixturePath = path.resolve(process.cwd(), "examples/customers-crud/flow.json");
        const baselineFlow = JSON.parse(await readFile(fixturePath, "utf8"));
        await request.post("/flows", { data: baselineFlow });
    });
    test("renders the customers route (table present, node-driven structure)", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");

        await expect(page.locator("table.webapp-table")).toBeVisible();
    });

    test("renders the customer-detail route", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers/c-100");

        // The "Back to customers" button renders as <sl-button> (button role, not link).
        await expect(page.getByRole("button", { name: "Back to customers" })).toBeVisible();
        // The route param :id is resolved and displayed in the page.
        await expect(page.locator(".webapp-grid")).toContainText("c-100");
    });

    test("renders the dialog when ?dialog=<id> is in the URL", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers?dialog=customerEditor");

        // P64: dialogs render as a native <sl-dialog> with a `label` attribute
        // (the title lives in Shoelace's shadow DOM, not a light-DOM heading).
        const dialog = page.locator("sl-dialog.webapp-dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute("label", "Edit customer");
        // Dialog content (mounted via dialog:customerEditor/content) renders inside it.
        await expect(dialog.getByRole("textbox", { name: "Name" })).toBeVisible();
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
