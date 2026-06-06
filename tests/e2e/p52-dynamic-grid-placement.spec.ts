import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P52 — dynamic grid placement via input message (ADR 0004, option A).
 *
 * A flow changes a view node's grid placement at runtime by sending
 * msg.ui.patch = { col, colSize } into the node's input. The runtime validates
 * the placement (P51's positive-integer rule, now enforced at runtime too),
 * applies it, and pushes a fresh snapshot over SSE — the element re-places in the
 * browser WITHOUT a reload. An invalid placement (col: 0) is rejected: the tile
 * stays where it was.
 *
 * The fixture's grid layout makes placement observable: the serializer emits an
 * inline `grid-column:<col> / span <colSize>` style on the tile's wrapper
 * (data-webapp-node="tile").
 */

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const content = await readFile(fixturePath, "utf8");
    return JSON.parse(content) as FlowNode[];
}

test.describe("dynamic grid placement (P52)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/p52-dynamic-grid-placement.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    // Restore the customers-crud baseline so later specs are not left with this fixture.
    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("a placement patch re-places the tile live, and an invalid patch is rejected", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p52App/stream"));
        await page.goto("/webapp/p52App/");

        const tile = page.locator('[data-webapp-node="tile"]');
        await expect(tile).toBeVisible();
        // Initial placement from the flow file: col 1.
        await expect(tile).toHaveAttribute("style", /grid-column:1/);

        await streamRequested;
        await page.waitForTimeout(500);

        // Mark the window so a full reload would be detectable.
        await page.evaluate(() => {
            (window as unknown as { __noReload?: boolean }).__noReload = true;
        });

        // Clicking the button drives button → function (msg.ui.patch) → tile input.
        await page.getByRole("button", { name: "Move tile" }).click();

        // The live snapshot push re-places the tile: col 5 / span 2 — no reload.
        await expect(tile).toHaveAttribute("style", /grid-column:5 \/ span 2/, { timeout: 10000 });

        const survived = await page.evaluate(
            () => (window as unknown as { __noReload?: boolean }).__noReload === true
        );
        expect(survived).toBe(true);

        // Now send an invalid placement (col: 0). It is rejected at runtime — the
        // tile stays at its last valid placement (col 5), it does not move.
        await page.getByRole("button", { name: "Bad move" }).click();
        await page.waitForTimeout(1000);
        await expect(tile).toHaveAttribute("style", /grid-column:5 \/ span 2/);
    });
});
