import { expect, test } from "@playwright/test";

/**
 * P33 — Customers CRUD, end to end, driven SOLELY by the wired flow.
 *
 * The whole thesis under test: every create / read / update / delete decision
 * lives in plain Node-RED `function` nodes wired into examples/customers-crud/
 * flow.json. The UI nodes only emit events out (P30) and receive store/action
 * updates back over the live SSE transport (P31). nodes/webapp.js performs NO
 * CRUD — delete the function nodes and these flows stop working.
 *
 * Each interaction below is a real Client→Server event whose downstream wiring
 * (ui-button/ui-table → function → ui-store/ui-action) drives the result:
 *   - list   : the table renders the seeded customers (from the customers store)
 *   - create : New → fill form → Save adds a row and closes the dialog
 *   - read   : clicking a row navigates to that customer's detail route
 *   - delete : Delete removes the customer and returns to the list
 */
test.describe("customers CRUD — wired flow (zero framework logic)", () => {
    // The flow keeps its data in the app's shared (broadcast) state, so mutations
    // persist across tests in the same Node-RED process. Re-trigger the seed
    // inject before each test to reset the demo to a known three-customer state.
    test.beforeEach(async ({ request }) => {
        await request.post("/inject/seedCustomers").catch(() => undefined);
    });

    test("the runtime reports raw events, never an actionId (P30 contract)", async ({ page }) => {
        await page.goto("/webapp/customersApp/customers");
        await expect(page.locator("table.webapp-table")).toBeVisible();

        const requestPromise = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/event") && req.method() === "POST"
        );
        await page.getByRole("button", { name: "New customer" }).click();

        const body = (await requestPromise).postDataJSON() as Record<string, unknown>;
        expect(body.actionId).toBeUndefined();
        expect(body.event).toBe("click");
        expect(typeof body.sourceId).toBe("string");
        expect(typeof body.clientId).toBe("string");
    });

    test("lists the seeded customers in the table", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;

        const table = page.locator("table.webapp-table");
        await expect(table).toContainText("Ada Lovelace");
        await expect(table).toContainText("Grace Hopper");
        await expect(table).toContainText("Radia Perlman");
    });

    test("CREATE: New → fill → Save adds a row and closes the dialog", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;
        await page.waitForTimeout(500);

        await page.getByRole("button", { name: "New customer" }).click();

        const dialog = page.locator(".webapp-dialog-card");
        await expect(dialog).toBeVisible({ timeout: 10000 });

        await dialog.getByRole("textbox", { name: "Name" }).fill("Margaret Hamilton");
        await dialog.getByRole("textbox", { name: "Email" }).fill("margaret@example.com");
        await dialog.getByRole("textbox", { name: "Status" }).fill("active");

        await dialog.getByRole("button", { name: "Save" }).click();

        // The wired save function pushes the new list (live re-render) and the
        // saveCustomer action closes the dialog.
        await expect(page.locator("table.webapp-table")).toContainText("Margaret Hamilton", {
            timeout: 10000
        });
        await expect(dialog).toBeHidden({ timeout: 10000 });
    });

    test("READ: clicking a row navigates to that customer's detail route", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;
        // The row link must be hydrated AND the SSE subscription registered
        // server-side before we click, or the navigate command has no subscriber.
        await expect(page.getByRole("link", { name: "Grace Hopper" })).toBeVisible();
        await page.waitForTimeout(800);

        await page.getByRole("link", { name: "Grace Hopper" }).click();

        await expect(page).toHaveURL(/\/customers\/c-200/, { timeout: 10000 });
        await expect(page.getByRole("button", { name: "Back to customers" })).toBeVisible();
    });

    test("DELETE: removing the current customer returns to a list without it", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;
        await page.waitForTimeout(500);

        // Select Radia, then delete from the detail page.
        await expect(page.getByRole("link", { name: "Radia Perlman" })).toBeVisible();
        await page.waitForTimeout(800);
        await page.getByRole("link", { name: "Radia Perlman" }).click();
        await expect(page).toHaveURL(/\/customers\/c-300/, { timeout: 10000 });

        // Detail page is freshly loaded; wait for the SSE subscription before the
        // delete click so the navigate-back command has a subscriber.
        await expect(page.getByRole("button", { name: "Delete customer" })).toBeVisible();
        await page.waitForTimeout(800);
        await page.getByRole("button", { name: "Delete customer" }).click();

        await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
        await expect(page.locator("table.webapp-table")).not.toContainText("Radia Perlman", {
            timeout: 10000
        });
    });
});
