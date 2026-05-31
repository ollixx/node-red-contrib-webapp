import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P22 — Snapshot transport + thin client runtime.
 *
 * The client runtime (resources/lib/webapp-client.js) hydrates from the JSON
 * snapshot endpoint, renders into #webapp-client-root, and on a UI event POSTs
 * to /webapp/:appId/event and re-renders from the returned snapshot — no full
 * page navigation. These specs drive that round-trip in a real browser.
 *
 * A dedicated fixture flow is used (not customers-crud) so the dispatched action
 * ids hit handled preview branches; the customers-crud preview action wiring is
 * a separate, pre-existing concern (spun off in P21).
 */

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const content = await readFile(fixturePath, "utf8");
    return JSON.parse(content) as FlowNode[];
}

test.describe("P22: snapshot transport thin client", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/p22-snapshot-transport.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    test.beforeEach(async ({ request }) => {
        const reset = await request.get("/webapp/p22App/reset");
        expect(reset.ok()).toBeTruthy();
    });

    test("serves the snapshot as JSON and the client runtime as a static resource", async ({ request }) => {
        const snapshot = await request.get("/webapp/p22App/snapshot?location=/customers");
        expect(snapshot.ok()).toBeTruthy();
        const body = await snapshot.json();
        expect(body.snapshot.appId).toBe("p22App");
        expect(Array.isArray(body.snapshot.regions)).toBeTruthy();

        const runtime = await request.get("/resources/node-red-contrib-webapp/lib/webapp-client.js");
        expect(runtime.ok()).toBeTruthy();
    });

    test("clicking a button updates bound content without a full page navigation", async ({ page }) => {
        await page.goto("/webapp/p22App/customers");
        await expect(page.locator("table.webapp-table")).toBeVisible();

        // Mark the document so a full navigation (which discards the marker) is detectable.
        await page.evaluate(() => {
            (window as unknown as { __webappNoReload?: boolean }).__webappNoReload = true;
        });

        // The dialog is not present until the New customer button is clicked.
        await expect(page.locator(".webapp-dialog-card")).toHaveCount(0);

        await page.getByRole("button", { name: "New customer" }).click();

        // The dialog now renders (bound content changed) and the page never reloaded.
        await expect(page.locator(".webapp-dialog-card")).toBeVisible();
        const survived = await page.evaluate(() => (window as unknown as { __webappNoReload?: boolean }).__webappNoReload === true);
        expect(survived).toBe(true);
    });

    test("a query-backed table re-renders new rows after a save action without losing scroll position", async ({ page }) => {
        await page.goto("/webapp/p22App/customers");
        await expect(page.locator("table.webapp-table")).toBeVisible();

        const rowsBefore = await page.locator("table.webapp-table tbody tr").count();

        // Open the editor, fill the name, and save — this adds a row to the query data.
        await page.getByRole("button", { name: "New customer" }).click();
        await expect(page.locator(".webapp-dialog-card")).toBeVisible();
        await page.locator('.webapp-dialog-card input[name="name"]').fill("Katherine Johnson");

        // Scroll the page down before the refresh to verify scroll survives the morph.
        await page.evaluate(() => window.scrollTo(0, 200));
        const scrollBefore = await page.evaluate(() => window.scrollY);

        await page.getByRole("button", { name: "Save" }).click();

        // The table re-rendered with one more row, driven by the new snapshot.
        await expect
            .poll(async () => page.locator("table.webapp-table tbody tr").count())
            .toBe(rowsBefore + 1);
        await expect(page.locator("table.webapp-table")).toContainText("Katherine Johnson");

        // Scroll position was preserved (no full reload, keyed morph kept the layout).
        const scrollAfter = await page.evaluate(() => window.scrollY);
        expect(scrollAfter).toBe(scrollBefore);
    });
});
