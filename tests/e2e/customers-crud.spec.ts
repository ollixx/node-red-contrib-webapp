import { expect, test } from "@playwright/test";

/**
 * P30: the customers-crud example is interaction-only until P33 rebuilds it as a
 * real wired flow. After P30 the browser only REPORTS events — it POSTs a raw
 * event { clientId, event, sourceId, params } (events.md) and never an actionId
 * to execute. The runtime emits msg.ui on the originating node's output port and
 * takes NO domain action, so a click no longer opens a dialog by itself (the live
 * Server→Client push that re-enables that round-trip via the wired flow is P31).
 *
 * This spec asserts the P30 client→server contract end to end in a real browser:
 * the seeded list renders, and clicking an interactive control POSTs the raw
 * event shape (sourceId + event, no actionId) and mutates no runtime state.
 */
test.describe("customers CRUD example — P30 client→server events", () => {
    test("renders the seeded list and reports a raw event on interaction (no actionId, no runtime mutation)", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");

        const tableRows = page.locator("table.webapp-table tbody tr");
        await expect(tableRows).toHaveCount(3);

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

        // The runtime takes no domain action: the list is unchanged and no row was
        // added (persistence — and any dialog — is the wired flow's job, arriving in P31).
        await expect(tableRows).toHaveCount(3);
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Katherine Johnson");
    });
});
