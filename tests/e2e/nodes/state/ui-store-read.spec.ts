import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P209 (ADR 0028) — ui-store-read: on-demand, NON-mutating store reader.
 *
 * Flow: a CLIENT-ONLY ui-store `entity` (initial {name:'A', city:'X'}); a
 * ui-store-read referencing it; three list triggers all carrying the browser
 * clientId:
 *   - SETB     → patch entity.name='B' per-client
 *   - READALL  → read whole slice (no path)          → stringified into a result store
 *   - READNAME → read with msg.path='name' (override) → stringified into a result store
 * A ui-text binds store(result).text and displays the emitted read payload.
 *
 * MEASURED on the EMITTED read message (surfaced via the result store), not on
 * node registration:
 *   - after SETB, READALL emits payload = {name:'B', city:'X'} (current per-client state)
 *   - READNAME emits payload = 'B' (path override)
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

test.describe("ui-store-read on-demand reader (P209)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p209-store-read.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("read emits the current per-client slice, and msg.path overrides it", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p209App/stream"));
        await page.goto("/webapp/p209App/");
        await streamRequested;
        await page.waitForTimeout(500);

        const readout = page.locator(".webapp-text").first();

        // Edit per-client state: name A → B (city untouched).
        await page.locator("li.webapp-list-item").filter({ hasText: "SETB" }).click();
        await page.waitForTimeout(300);

        // READALL: the reader emits the WHOLE current per-client slice.
        await page.locator("li.webapp-list-item").filter({ hasText: "READALL" }).click();
        await expect(readout).toHaveText('{"name":"B","city":"X"}', { timeout: 10000 });

        // READNAME: msg.path='name' override → the reader emits just 'B'.
        await page.locator("li.webapp-list-item").filter({ hasText: "READNAME" }).click();
        await expect(readout).toHaveText("B", { timeout: 10000 });
    });
});
