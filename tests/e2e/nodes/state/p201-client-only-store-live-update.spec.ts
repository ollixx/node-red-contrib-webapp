import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P201 — a CLIENT-ONLY store, updated per-client (the op carries msg.ui.clientId),
 * must live-update a store-bound view. Mirrors the owner's Entity Editor:
 *   - ui-store scope=client-only, statePath "entity", initial {name:"Alpha"}
 *   - text 0 binds store(p201Store).name  (subPath — the owner's exact case)
 *   - text 1 binds state("entity.name")   (isolates subPath vs client-only)
 *   - a button click (a real Client→Server event carrying the browser clientId)
 *     wires through a function that does `msg.ui.store = {...}` (PRESERVING
 *     msg.ui.clientId) into the store → a per-client op.
 * After the click both texts must show "Bravo" live.
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

test.describe("client-only store per-client live update (P201)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p201-client-only-store.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("a per-client store replace live-updates both the store-subPath and state bound texts", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) => req.url().includes("/webapp/p201App/stream"));
        await page.goto("/webapp/p201App/");

        const texts = page.locator(".webapp-text");
        await expect(texts.nth(0)).toHaveText("Alpha"); // store(entity).name
        await expect(texts.nth(1)).toHaveText("Alpha"); // state entity.name
        await streamRequested;
        await page.waitForTimeout(500);

        // Faithful to the Entity Editor: click a ui-list item; the itemClick
        // (carrying the browser clientId) feeds a function that replaces the
        // per-client store slice with { name: msg.ui.params.row.label }.
        await page.locator("li.webapp-list-item").filter({ hasText: "Banana" }).click();

        // The owner's exact case first: the store-subPath text (in a container).
        await expect(texts.nth(0)).toHaveText("Banana", { timeout: 10000 });
        // And the state-path text (isolates whether the bug is subPath-specific).
        await expect(texts.nth(1)).toHaveText("Banana", { timeout: 10000 });
    });
});
