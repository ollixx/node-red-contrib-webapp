import { expect, test } from "@playwright/test";

/**
 * P30/P32: the customers-crud example routes client events to the wired flow.
 * After P30 the browser only REPORTS events — it POSTs a raw event
 * { clientId, event, sourceId, params } (events.md) and never an actionId
 * to execute. The runtime emits msg.ui on the originating node's output port and
 * takes NO domain action.
 *
 * P32 removed previewData so the table starts empty until a real wired flow
 * pushes data via ui-query. P33 will rebuild that wiring.
 *
 * This spec asserts the P30 client→server contract end to end in a real browser:
 * the app page loads with its node-driven structure (table element present), and
 * clicking an interactive control POSTs the raw event shape (sourceId + event,
 * no actionId) without mutating runtime state.
 */
test.describe("customers CRUD example — P30/P32 client→server events", () => {
    test("renders the app structure and reports a raw event on interaction (no actionId, no runtime mutation)", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");

        // The table is present as part of the node-driven structure.
        // After P32 there are no pre-seeded rows (previewData was removed);
        // P33 will wire the flow to push real data.
        await expect(page.locator("table.webapp-table")).toBeVisible();

        // Capture the event POST the thin client makes on interaction.
        const requestPromise = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/event") && req.method() === "POST"
        );

        await page.getByRole("button", { name: "New customer" }).click();

        const eventRequest = await requestPromise;
        const body = eventRequest.postDataJSON() as Record<string, unknown>;

        // The browser reports WHAT HAPPENED: a raw event, never an actionId.
        expect(body.actionId).toBeUndefined();
        expect(body.event).toBe("click");
        expect(typeof body.sourceId).toBe("string");
        expect((body.sourceId as string).length).toBeGreaterThan(0);
        expect(typeof body.clientId).toBe("string");
    });
});
