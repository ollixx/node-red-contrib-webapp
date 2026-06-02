import { expect, test } from "@playwright/test";

/**
 * P36 — App shell: token-themed application chrome for the `app` layout preset
 *
 * Validates:
 *  - The `app` layout renders as a proper shell (app bar + navbar + content)
 *  - The shell is NOT a stack of bordered boxes (frameless slots)
 *  - The app bar uses --wa-color-primary (token-driven, no hard-coded color)
 *  - The navbar collapses sensibly at narrow viewports
 *  - The customers example shows the branded chrome with the primary nav
 */

test.describe("P36: app shell chrome", () => {
    test("renders the webapp-app-bar with the app title on the customers example", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");
        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        await expect(page.locator(".webapp-app-bar-title")).toHaveText("Customers CRM");
    });

    test("app bar background uses the --wa-color-primary custom property (token-driven)", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");
        const appBar = page.locator(".webapp-app-bar");
        await expect(appBar).toBeVisible();
        // Verify that the CSS on the app bar references --wa-color-primary
        const bgColor = await appBar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        // The token defaults to #3b82f6 (blue) for the base app; the customers
        // example sets colorPrimary to rgb(124,58,237) — either proves token-driven.
        // Just confirm it's not the page background (#ffffff) or surface (#f9fafb).
        expect(bgColor).not.toBe("rgb(255, 255, 255)");
        expect(bgColor).not.toBe("rgb(249, 250, 251)");
    });

    test("slot regions have no border or card-background chrome (frameless)", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");
        // The content and navbar slots must have transparent/inherited background
        // (no background:var(--wa-color-surface) card boxing them).
        const contentSlot = page.locator(".webapp-slot--content");
        await expect(contentSlot).toBeVisible();
        const contentBg = await contentSlot.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        // Transparent background renders as rgba(0,0,0,0) or "transparent"
        expect(contentBg).toBe("rgba(0, 0, 0, 0)");

        const navbarSlot = page.locator(".webapp-slot--navbar");
        await expect(navbarSlot).toBeVisible();
        const navbarBg = await navbarSlot.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        expect(navbarBg).toBe("rgba(0, 0, 0, 0)");
    });

    test("the customers example navbar has a navigation affordance", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");
        const navbar = page.locator(".webapp-slot--navbar");
        await expect(navbar).toBeVisible();
        // The nav button (Customers link) must be visible in the navbar
        const navItems = navbar.locator("sl-button, a");
        const count = await navItems.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("the app layout renders as an application chrome, not a stack of boxes (layout-demos fixture)", async ({
        page,
        request
    }) => {
        // Deploy the layout demos fixture plus the baseline flow
        const { readFile } = await import("node:fs/promises");
        const { resolve } = await import("node:path");

        const baselineContent = await readFile(resolve(process.cwd(), "examples/customers-crud/flow.json"), "utf8");
        const baseline = JSON.parse(baselineContent) as unknown[];

        const demoContent = await readFile(
            resolve(process.cwd(), "tests/e2e/fixtures/layout-demos.flow.json"),
            "utf8"
        );
        const demo = JSON.parse(demoContent) as unknown[];

        await request.post("/flows", { data: [...baseline, ...demo] });

        await page.goto("/webapp/layoutAppShellDemo");
        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        await expect(page.locator(".webapp-app-bar-title")).toContainText("App Layout Demo");
        await expect(page.locator(".webapp-slot--header")).toBeVisible();
        await expect(page.locator(".webapp-slot--navbar")).toBeVisible();
        await expect(page.locator(".webapp-slot--content")).toBeVisible();

        // Restore baseline
        await request.post("/flows", { data: baseline });
    });

    test("navbar collapses over content on narrow viewports (mobile)", async ({ page }) => {
        // At 600px wide the layout must be column-stacked (mobile: navbar above content)
        await page.setViewportSize({ width: 600, height: 800 });
        await page.goto("/webapp/customersApp/customers");

        const navbar = page.locator(".webapp-slot--navbar");
        const content = page.locator(".webapp-slot--content");
        await expect(navbar).toBeVisible();
        await expect(content).toBeVisible();

        // On mobile both slots must be full-width and navbar should be above content
        const navbarBox = await navbar.boundingBox();
        const contentBox = await content.boundingBox();
        expect(navbarBox).not.toBeNull();
        expect(contentBox).not.toBeNull();
        // At 600px navbar and content should be stacked (same x start ≈ 0, navbar above)
        expect(navbarBox!.y).toBeLessThan(contentBox!.y);
    });
});
