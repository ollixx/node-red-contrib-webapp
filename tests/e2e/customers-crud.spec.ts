import { expect, test } from "@playwright/test";

test.describe("customers CRUD preview", () => {
    test.beforeEach(async ({ request }) => {
        const response = await request.get("/webapp/customersApp/reset");
        expect(response.ok()).toBeTruthy();
    });

    test("creates, reads, updates, deletes and logs UI messages", async ({ page, request }) => {
        await page.goto("/webapp/customersApp/customers");

        const tableRows = page.locator("table.webapp-table tbody tr");
        await expect(tableRows).toHaveCount(3);

        await page.getByRole("link", { name: "New customer" }).click();
        await expect(page.getByRole("heading", { name: "Edit customer" })).toBeVisible();

        await page.locator("#webapp-form-customerForm input[name='name']").fill("Katherine Johnson");
        await page.locator("#webapp-form-customerForm input[name='email']").fill("katherine@example.com");
        await page.locator("#webapp-form-customerForm input[name='status']").fill("active");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers$/);
        await expect(tableRows).toHaveCount(4);
        await expect(page.locator("table.webapp-table tbody")).toContainText("Katherine Johnson");
        await expect(page.locator(".webapp-events")).toContainText("saveCustomer");

        await page.getByRole("link", { name: "Katherine Johnson" }).click();
        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers\/c-400$/);
        await expect(page.getByRole("link", { name: "Back to customers" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Edit customer" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Delete customer" })).toBeVisible();
        await expect(page.locator(".webapp-grid")).toContainText("c-400");

        await page.getByRole("link", { name: "Edit customer" }).click();
        await expect(page.getByRole("heading", { name: "Edit customer" })).toBeVisible();
        await expect(page.locator("#webapp-form-customerForm input[name='name']")).toHaveValue("Katherine Johnson");
        await page.locator("#webapp-form-customerForm input[name='status']").fill("vip");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers$/);
        await expect(page.locator("table.webapp-table tbody")).toContainText("vip");

        await page.getByRole("link", { name: "Katherine Johnson" }).click();
        await page.getByRole("link", { name: "Delete customer" }).click();
        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers$/);
        await expect(tableRows).toHaveCount(3);
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Katherine Johnson");

        const eventsResponse = await request.get("/webapp/customersApp/events");
        expect(eventsResponse.ok()).toBeTruthy();
        const eventsPayload = await eventsResponse.json();
        const actions = eventsPayload.messages.map((entry: { message: { ui: { action?: string } } }) => entry.message.ui.action);

        expect(actions).toEqual(expect.arrayContaining([
            "openCustomerEditor",
            "saveCustomer",
            "openCustomerDetail",
            "deleteCustomer"
        ]));
    });
});