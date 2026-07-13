import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P218 (ADR 0033) — the owner's refresh→replace repro.
 *
 * A consumed `msg.ui.query` refresh command must be re-emitted by `ui-query` as a
 * CLEAN fetch trigger: the incidental `msg.payload` that rode in with the trigger
 * is DROPPED, so a downstream replace-consumer cannot fold it as query DATA.
 *
 * Flow (mirrors the dev "Entity Editor" case):
 *   list REFRESH → fn sets msg.payload = "POISON" → ui-query-action(refresh, wire)
 *     → ui-query "items" (applies refresh, forwards a CLEAN trigger)
 *     → fn "derive data": payload is now undefined ⇒ sentinel "CLEAN"; if the
 *       stale "POISON" survived (the bug) it would be folded instead
 *     → ui-query-action(replace, reference) writes the query data live (per-client).
 *   A ui-text bound to `query:items` surfaces the result.
 *
 * MEASURED on the rendered effect (owner's rule — not tags/classes):
 *   - after REFRESH the query readout shows "CLEAN" (the refresh pipeline RAN and
 *     the stale payload was stripped) and NEVER "POISON" (no double-processing).
 * This turns RED if the envelope-cleanup is removed: the query would read "POISON".
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

test.describe("ui-query refresh→replace envelope cleanup (P218)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p218-refresh-replace-cleanup.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("a refresh does NOT let the stale trigger payload overwrite the query", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p218App/stream"));
        await page.goto("/webapp/p218App/");
        await streamRequested;
        await page.waitForTimeout(500);

        const queryReadout = page.locator(".webapp-text").nth(0);

        // Initial: no query data set yet.
        await expect(queryReadout).not.toHaveText("POISON");
        await expect(queryReadout).not.toHaveText("CLEAN");

        // REFRESH — the click carries a poison payload. After the ui-query hop the
        // payload is stripped, so the replace-consumer folds the "CLEAN" sentinel.
        await page.locator("li.webapp-list-item").filter({ hasText: "REFRESH" }).click();

        await expect(queryReadout).toHaveText("CLEAN", { timeout: 10000 });
        // The stale payload never reached the query data.
        await expect(queryReadout).not.toHaveText("POISON");
    });
});
