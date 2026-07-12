import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P211 (ADR 0029) — ui-store-action: typed, reference-based store MUTATION with
 * a hybrid mode (reference | wire).
 *
 * Flow: a CLIENT-ONLY ui-store `entity` (initial {name:'A', city:'X'}); a
 * ui-text bound to store(entity).name; a second ui-text bound to a `result`
 * store used to surface the wire-mode envelope. Two list triggers (both carry
 * the browser clientId):
 *   - REFSET  → payload 'B' → ui-store-action(mode=reference, op=set, path=name)
 *               applies the op DIRECTLY (no wire to the store) and pushes a fresh
 *               snapshot.
 *   - WIRESET → payload 'C' → ui-store-action(mode=wire, op=set, path=name) does
 *               NOT mutate; it EMITS msg.ui.store = {id,op,path,value}. A function
 *               stringifies that envelope into the `result` store.
 *
 * MEASURED on the rendered effect (owner's rule — not on tags/classes):
 *   - reference mode: after REFSET the entity readout shows 'B' live.
 *   - wire mode: after WIRESET the envelope readout shows the correct
 *     {id,op,path,value}; the entity readout stays 'B' (wire mode did NOT mutate).
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

test.describe("ui-store-action typed mutation, hybrid mode (P211)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p211-store-action.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("reference mode mutates live; wire mode emits the correct envelope without mutating", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p211App/stream"));
        await page.goto("/webapp/p211App/");
        await streamRequested;
        await page.waitForTimeout(500);

        const entityReadout = page.locator(".webapp-text").nth(0);
        const envelopeReadout = page.locator(".webapp-text").nth(1);

        // Initial per-client state: entity.name = 'A'.
        await expect(entityReadout).toHaveText("A", { timeout: 10000 });

        // REFSET — reference mode applies op=set path=name value='B' DIRECTLY.
        await page.locator("li.webapp-list-item").filter({ hasText: "REFSET" }).click();
        await expect(entityReadout).toHaveText("B", { timeout: 10000 });

        // WIRESET — wire mode emits the envelope; a function surfaces it via `result`.
        await page.locator("li.webapp-list-item").filter({ hasText: "WIRESET" }).click();
        await expect(envelopeReadout).toHaveText(
            '{"id":"p211Store","op":"set","path":"name","value":"C"}',
            { timeout: 10000 }
        );

        // Wire mode must NOT have mutated the entity store — still 'B', not 'C'.
        await expect(entityReadout).toHaveText("B");
    });
});
