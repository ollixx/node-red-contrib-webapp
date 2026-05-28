import { expect, test } from "@playwright/test";

async function followActionLink(page: Parameters<typeof test>[0]["page"], name: string): Promise<void> {
    const link = page.getByRole("link", { name }).first();
    const href = await link.getAttribute("href");

    expect(href).toBeTruthy();
    await page.goto(String(href));
}

test.describe("customers CRUD preview", () => {
    test.beforeEach(async ({ request }) => {
        const response = await request.get("/webapp/customersApp/reset");
        expect(response.ok()).toBeTruthy();
    });

    test("creates, reads, updates and deletes customers", async ({ page, request }) => {
        await page.goto("/webapp/customersApp/customers");

        const tableRows = page.locator("table.webapp-table tbody tr");
        await expect(tableRows).toHaveCount(3);

        await followActionLink(page, "New customer");
        await expect(page.getByRole("heading", { name: "Edit customer" })).toBeVisible();
        const dialog = page.locator(".webapp-dialog-card");

        await dialog.getByRole("textbox", { name: "Name" }).fill("Katherine Johnson");
        await dialog.getByRole("textbox", { name: "Email" }).fill("katherine@example.com");
        await dialog.getByRole("textbox", { name: "Status" }).fill("active");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers$/);
        await expect(tableRows).toHaveCount(4);
        await expect(page.locator("table.webapp-table tbody")).toContainText("Katherine Johnson");

        await followActionLink(page, "Katherine Johnson");
        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers\/c-400$/);
        await expect(page.getByRole("link", { name: "Back to customers" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Edit customer" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Delete customer" })).toBeVisible();
        await expect(page.locator(".webapp-grid")).toContainText("c-400");

        await followActionLink(page, "Edit customer");
        await expect(page.getByRole("heading", { name: "Edit customer" })).toBeVisible();
        await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Katherine Johnson");
        await dialog.getByRole("textbox", { name: "Status" }).fill("vip");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers$/);
        await expect(page.locator("table.webapp-table tbody")).toContainText("vip");

        await followActionLink(page, "Katherine Johnson");
        await followActionLink(page, "Delete customer");
        await expect(page).toHaveURL(/\/webapp\/customersApp\/customers$/);

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