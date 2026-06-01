import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P22/P30/P32 — Live client/server event transport.
 *
 * The client runtime (resources/lib/webapp-client.js) connects to the SSE
 * stream and on a UI event POSTs to /webapp/:appId/event. The POST is a RAW
 * client event { clientId, event, sourceId, params } (events.md) — never an
 * actionId to execute. The runtime routes it to the originating node, emits
 * msg.ui on that node's output port, and takes no domain action.
 *
 * Note (P32): the /snapshot endpoint was removed. The thin client now uses the
 * SSE /stream endpoint for initial hydration and live updates.
 *
 * A dedicated fixture flow is used (not customers-crud) so the assertions are
 * independent of the example's own wiring.
 */

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const content = await readFile(fixturePath, "utf8");
    return JSON.parse(content) as FlowNode[];
}

test.describe("live event transport (P30 events)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/p22-snapshot-transport.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    test("the client runtime is served as a static resource", async ({ request }) => {
        const runtime = await request.get("/resources/node-red-contrib-webapp/lib/webapp-client.js");
        expect(runtime.ok()).toBeTruthy();
    });

    test("clicking a button reports a raw event (sourceId + event, no actionId) without a full navigation", async ({ page }) => {
        await page.goto("/webapp/p22App/customers");
        await expect(page.locator("table.webapp-table")).toBeVisible();

        // Mark the document so a full navigation (which discards the marker) is detectable.
        await page.evaluate(() => {
            (window as unknown as { __webappNoReload?: boolean }).__webappNoReload = true;
        });

        const requestPromise = page.waitForRequest((req) =>
            req.url().includes("/webapp/p22App/event") && req.method() === "POST"
        );

        await page.getByRole("button", { name: "New customer" }).click();

        const eventRequest = await requestPromise;
        const body = eventRequest.postDataJSON() as Record<string, unknown>;

        // P30 contract: the browser reports WHAT HAPPENED, never an action to run.
        expect(body.actionId).toBeUndefined();
        expect(body.event).toBe("click");
        expect(typeof body.sourceId).toBe("string");
        expect(typeof body.clientId).toBe("string");

        // The page never reloaded — the thin client handled the event in place.
        const survived = await page.evaluate(() => (window as unknown as { __webappNoReload?: boolean }).__webappNoReload === true);
        expect(survived).toBe(true);
    });

    test("the runtime takes no domain action on a client event — the query-backed table is unchanged", async ({ page }) => {
        await page.goto("/webapp/p22App/customers");
        await expect(page.locator("table.webapp-table")).toBeVisible();

        const rowsBefore = await page.locator("table.webapp-table tbody tr").count();

        const eventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/p22App/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "New customer" }).click();
        await eventResponse;

        // No business data was written and no auto event→action link fired: the row
        // count is unchanged (any reaction is the wired flow's job, arriving via SSE push).
        await expect
            .poll(async () => page.locator("table.webapp-table tbody tr").count())
            .toBe(rowsBefore);
    });
});
