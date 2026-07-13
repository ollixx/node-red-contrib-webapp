import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P213 (ADR 0029) — ui-query-action action `replace`: the DATA-IN side of
 * `refresh`. `msg.payload` becomes the referenced query's data.
 *
 * Flow: a ui-query `items` (no wired retrieval — replace writes its data
 * directly). A ui-text bound to `query:items` surfaces the query data; a second
 * ui-text bound to a `result` store surfaces the wire-mode envelope. Two list
 * triggers (both carry the browser clientId):
 *   - REPLACE-REF  → ui-query-action(action=replace, mode=reference) writes
 *                    msg.payload ("REPLACED") DIRECTLY into ui.queries.items.data,
 *                    per-client, with an SSE re-render. No wire to the query.
 *   - REPLACE-WIRE → ui-query-action(action=replace, mode=wire) does NOT mutate;
 *                    it EMITS msg.ui.query = { queryPath:"items", data:[{id:1,
 *                    name:"Ada"}] }. A function stringifies that envelope into the
 *                    `result` store.
 *
 * MEASURED on the rendered effect (owner's rule — not on tags/classes):
 *   - wire mode: after REPLACE-WIRE the envelope readout shows the correct
 *     {queryPath, data:[…]}; the query readout stays EMPTY (wire mode did NOT
 *     write the query state).
 *   - reference mode: after REPLACE-REF the query readout shows "REPLACED" —
 *     proof the query's data was set live, with no wire from the action.
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

test.describe("ui-query-action action=replace, hybrid mode (P213)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p213-query-action-replace.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("wire mode emits the {queryPath,data} envelope without mutating; reference mode sets the query data live", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p213App/stream"));
        await page.goto("/webapp/p213App/");
        await streamRequested;
        await page.waitForTimeout(500);

        const queryReadout = page.locator(".webapp-text").nth(0);
        const envelopeReadout = page.locator(".webapp-text").nth(1);

        // Initial: no query data has been set yet.
        await expect(queryReadout).not.toHaveText("REPLACED");

        // REPLACE-WIRE — wire mode emits { queryPath:"items", data:[{id:1,name:"Ada"}] }
        // and must NOT write the query state.
        await page.locator("li.webapp-list-item").filter({ hasText: "REPLACE-WIRE" }).click();
        await expect(envelopeReadout).toHaveText(
            '{"queryPath":"items","data":[{"id":1,"name":"Ada"}]}',
            { timeout: 10000 }
        );
        // Wire mode did NOT set the query data — the readout is still empty.
        await expect(queryReadout).not.toHaveText("REPLACED");

        // REPLACE-REF — reference mode writes the query's data directly; the bound
        // query readout fills live via SSE.
        await page.locator("li.webapp-list-item").filter({ hasText: "REPLACE-REF" }).click();
        await expect(queryReadout).toHaveText("REPLACED", { timeout: 10000 });
    });
});
