import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P212 (ADR 0029) — ui-query-action: typed, reference-based query TRIGGER with a
 * hybrid mode (reference | wire).
 *
 * Flow: a ui-query `items` whose OUT-PORT is wired to a retrieval provider
 * (function) that returns `msg.ui.query = {queryPath:"items", data:"LOADED"}`
 * back into the query IN-PORT — the genuine refresh→retrieve→persist pipeline. A
 * ui-text bound to `query:items` surfaces the retrieved data; a second ui-text
 * bound to a `result` store surfaces the wire-mode envelope. Two list triggers
 * (both carry the browser clientId):
 *   - REFRESH → ui-query-action(mode=reference) fires the query's refresh
 *               DIRECTLY (no wire to the query); the retrieval provider runs and
 *               the query readout fills with "LOADED".
 *   - WIRE    → ui-query-action(mode=wire) does NOT trigger; it EMITS
 *               msg.ui.query = {queryPath, refresh:true, params}. A function
 *               stringifies that envelope into the `result` store.
 *
 * MEASURED on the rendered effect (owner's rule — not on tags/classes):
 *   - wire mode: after WIRE the envelope readout shows the correct
 *     {queryPath, refresh:true, params}; the query readout stays EMPTY (wire mode
 *     did NOT trigger the retrieval).
 *   - reference mode: after REFRESH the query readout shows "LOADED" — proof the
 *     retrieval pipeline ran after the trigger, with no wire from the action.
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

test.describe("ui-query-action typed query trigger, hybrid mode (P212)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p212-query-action.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("wire mode emits the correct envelope without triggering; reference mode triggers the retrieval", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p212App/stream"));
        await page.goto("/webapp/p212App/");
        await streamRequested;
        await page.waitForTimeout(500);

        const queryReadout = page.locator(".webapp-text").nth(0);
        const envelopeReadout = page.locator(".webapp-text").nth(1);

        // Initial: no query data has been retrieved yet.
        await expect(queryReadout).not.toHaveText("LOADED");

        // WIRE — wire mode emits { queryPath, refresh:true, params:{page:2} } and
        // must NOT trigger the retrieval pipeline.
        await page.locator("li.webapp-list-item").filter({ hasText: "WIRE" }).click();
        await expect(envelopeReadout).toHaveText(
            '{"queryPath":"items","refresh":true,"params":{"page":2}}',
            { timeout: 10000 }
        );
        // Wire mode did NOT run the query — the readout is still not "LOADED".
        await expect(queryReadout).not.toHaveText("LOADED");

        // REFRESH — reference mode fires the query's refresh directly; the wired
        // retrieval provider runs and the query readout fills.
        await page.locator("li.webapp-list-item").filter({ hasText: "REFRESH" }).click();
        await expect(queryReadout).toHaveText("LOADED", { timeout: 10000 });
    });
});
