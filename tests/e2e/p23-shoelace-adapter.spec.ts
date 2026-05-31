import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type FlowNode = Record<string, unknown>;

/**
 * P23 — the default rendering target is Web Components (Shoelace). The
 * customers-crud example renders through the Web Component adapter (containers
 * and the dialog become <sl-card>), and the ui-app design tokens are applied as
 * CSS custom properties consumed natively by the components.
 */
test.describe("P23: Shoelace Web Component adapter", () => {
    let baselineFlow: FlowNode[];

    test.beforeAll(async () => {
        const fixturePath = path.resolve(process.cwd(), "examples/customers-crud/flow.json");
        baselineFlow = JSON.parse(await readFile(fixturePath, "utf8")) as FlowNode[];
    });

    test.beforeEach(async ({ request }) => {
        // Re-deploy the customers flow so this spec is independent of suite order
        // (earlier specs deploy other apps over the shared Node-RED instance).
        const deploy = await request.post("/flows", { data: baselineFlow });
        expect(deploy.ok()).toBeTruthy();

        const response = await request.get("/webapp/customersApp/reset");
        expect(response.ok()).toBeTruthy();
    });

    test("renders the customers example through the Web Component adapter (sl-card)", async ({ page }) => {
        // The editor dialog is a container kind, which the adapter maps to a
        // Shoelace card. This holds on the first server render *and* after the
        // thin client hydrates and re-renders from the JSON snapshot.
        await page.goto("/webapp/customersApp/customers?dialog=customerEditor");

        await expect(page.locator("sl-card").first()).toBeVisible();
        // The native, accessible controls still render inside the card shell.
        await expect(page.locator("sl-card table.webapp-table, sl-card input")).not.toHaveCount(0);
    });

    test("applies the configured primary color token as a CSS custom property", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");

        // The ui-app token set --wa-color-primary reaches :root…
        const primary = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue("--wa-color-primary").trim()
        );
        expect(primary).toBe("rgb(124, 58, 237)");

        // …and is applied as a custom property on :root so the Web Components can consume it.
        // We verify the property is present and matches the configured value.
        expect(primary).toBeTruthy();
    });

    test("renders the dialog as a Shoelace card", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers?dialog=customerEditor");

        const card = page.locator("sl-card.webapp-dialog-card");
        await expect(card).toBeVisible();
        await expect(card.getByRole("textbox", { name: "Name" })).toBeVisible();
    });
});
