import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type FlowNode = Record<string, unknown>;

/**
 * P63 / ADR 0008 — Shoelace is self-hosted (vendored), strictly local, no CDN.
 *
 * Offline correctness: the rendered app must load the theme + autoloader from
 * the local module-resource path (/resources/node-red-contrib-webapp/shoelace/…),
 * Shoelace custom elements must upgrade (including a lazily-loaded element), and
 * the page must make NO request to any external Shoelace CDN (cdn.jsdelivr.net,
 * unpkg, …). All Shoelace requests must hit the local Node-RED origin.
 *
 * Prerequisite: `pnpm build` (or `pnpm vendor:shoelace`) must have populated
 * resources/shoelace/ — the playwright webServer rebuild relies on it.
 */
test.describe("P63: Shoelace served strictly locally (offline)", () => {
    let baselineFlow: FlowNode[];

    test.beforeAll(async () => {
        const fixturePath = path.resolve(process.cwd(), "examples/customers-crud/flow.json");
        baselineFlow = JSON.parse(await readFile(fixturePath, "utf8")) as FlowNode[];
    });

    test.beforeEach(async ({ request, page }) => {
        const deploy = await request.post("/flows", { data: baselineFlow });
        expect(deploy.ok()).toBeTruthy();
        await page.waitForTimeout(150);
    });

    test("loads theme + autoloader from the local resource path", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");

        const themeHref = await page
            .locator('link[rel="stylesheet"][href*="shoelace"]')
            .first()
            .getAttribute("href");
        expect(themeHref).toBe("/resources/node-red-contrib-webapp/shoelace/themes/light.css");

        const autoloaderSrc = await page
            .locator('script[src*="shoelace-autoloader"]')
            .first()
            .getAttribute("src");
        expect(autoloaderSrc).toBe(
            "/resources/node-red-contrib-webapp/shoelace/shoelace-autoloader.js"
        );
    });

    test("makes NO request to any external Shoelace CDN; all from local origin", async ({ page }) => {
        const externalShoelaceRequests: string[] = [];
        const shoelaceRequests: string[] = [];

        page.on("request", (req) => {
            const url = req.url();
            if (/jsdelivr|unpkg|cdnjs/i.test(url)) {
                externalShoelaceRequests.push(url);
            }
            if (/shoelace/i.test(url)) {
                shoelaceRequests.push(url);
            }
        });

        await page.goto("/webapp/customersApp/customers?dialog=customerEditor");
        // Trigger lazy component loading: the dialog/card and form controls.
        await expect(page.locator("table.webapp-table")).toBeVisible();
        await page.waitForTimeout(500);

        expect(externalShoelaceRequests).toEqual([]);
        // Every Shoelace request (autoloader, lazy chunks, sl-icon assets) is local.
        for (const url of shoelaceRequests) {
            expect(url).toContain("/resources/node-red-contrib-webapp/shoelace/");
        }
        // Sanity: at least the autoloader was actually fetched locally.
        expect(shoelaceRequests.length).toBeGreaterThan(0);
    });

    test("an sl-button upgrades (custom element defined) without network", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");
        await expect(page.locator("sl-button").first()).toBeVisible();

        const defined = await page.evaluate(async () => {
            await customElements.whenDefined("sl-button");
            const el = document.querySelector("sl-button");
            // An upgraded element has a shadow root rendered by Shoelace.
            return Boolean(el && el.shadowRoot);
        });
        expect(defined).toBe(true);
    });

    test("a lazily-loaded element (sl-dialog) upgrades from local chunks", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers?dialog=customerEditor");
        // P64: the dialog renders as a native <sl-dialog> (lazily loaded via the
        // local autoloader chunks, like every other Shoelace element).
        const dialog = page.locator("sl-dialog.webapp-dialog");
        await expect(dialog).toBeVisible();

        const dialogDefined = await page.evaluate(async () => {
            await customElements.whenDefined("sl-dialog");
            const el = document.querySelector("sl-dialog");
            return Boolean(el && el.shadowRoot);
        });
        expect(dialogDefined).toBe(true);
    });
});
