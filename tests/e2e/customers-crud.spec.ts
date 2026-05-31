import { expect, test } from "@playwright/test";

/**
 * P29: the customers-crud example is interaction-only until P33 rebuilds it as a
 * real wired flow. The runtime performs NO CRUD — actions only change interaction
 * state (open/close the editor dialog). This spec asserts exactly that: the seeded
 * list renders, the editor opens, the save action closes the dialog WITHOUT adding
 * a row (persistence is the wired flow's job), and the interaction-only action
 * events are emitted.
 */
test.describe("customers CRUD example (interaction-only until P33)", () => {
    test.beforeEach(async ({ request }) => {
        const response = await request.get("/webapp/customersApp/reset");
        expect(response.ok()).toBeTruthy();
    });

    test("renders the seeded list and drives dialog interaction state without runtime CRUD", async ({ page, request }) => {
        await page.goto("/webapp/customersApp/customers");

        const tableRows = page.locator("table.webapp-table tbody tr");
        await expect(tableRows).toHaveCount(3);

        // Open the editor (a show action) and fill it in.
        await page.getByRole("button", { name: "New customer" }).click();
        await expect(page.getByRole("heading", { name: "Edit customer" })).toBeVisible();
        const dialog = page.locator(".webapp-dialog-card");

        await dialog.getByRole("textbox", { name: "Name" }).fill("Katherine Johnson");
        await dialog.getByRole("textbox", { name: "Email" }).fill("katherine@example.com");
        await dialog.getByRole("textbox", { name: "Status" }).fill("active");

        // Save is now an interaction-only hide action: the dialog closes and the
        // list is unchanged — persistence is the wired flow's responsibility.
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.locator(".webapp-dialog-card")).toHaveCount(0);
        await expect(tableRows).toHaveCount(3);
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Katherine Johnson");

        const eventsResponse = await request.get("/webapp/customersApp/events");
        expect(eventsResponse.ok()).toBeTruthy();
        const eventsPayload = await eventsResponse.json();
        const actions = eventsPayload.messages.map((entry: { message: { ui: { action?: string } } }) => entry.message.ui.action);

        expect(actions).toEqual(expect.arrayContaining([
            "openCustomerEditor",
            "saveCustomer"
        ]));
    });
});
