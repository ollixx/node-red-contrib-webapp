import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * P34 — Customers CRUD: full-journey E2E from the app root.
 *
 * The whole thesis under test: every create / read / update / delete decision
 * lives in plain Node-RED `function` nodes wired into examples/customers-crud/
 * flow.json. The UI nodes only emit events out (P30) and receive store/action
 * updates back over the live SSE transport (P31). nodes/webapp.js performs NO
 * CRUD — delete the function nodes and these flows stop working.
 *
 * The suite starts at "/" (the app root) and drives the full user journey:
 *   home → list → CREATE → READ → UPDATE → DELETE
 * including the previously-dead "Go to customers" and "Back" controls.
 *
 * No page.waitForTimeout calls are used. Every wait is on a real condition:
 * network response, element state, or element text.
 *
 * P41: this is an INTEGRATION smoke test, not a per-node regression guard. Every
 * describe here is tagged @integration and excluded from the default
 * `pnpm exec playwright test` run (see playwright.config.ts). Run it explicitly:
 *     pnpm test:e2e:integration        (sets E2E_INTEGRATION=1)
 * The env flag — not a CLI --grep — is the toggle, because Playwright ANDs a CLI
 * --grep with the config grep/grepInvert rather than replacing it.
 */

// ── setup ─────────────────────────────────────────────────────────────────────

test.describe("customers CRUD — wired flow (zero framework logic) @integration", () => {
    // Re-seed the store before each test so mutations from the previous test
    // don't carry over. The seed inject node (once:true at startup) has already
    // fired; we POST to Node-RED's built-in /inject/:id endpoint to re-trigger it.
    test.beforeEach(async ({ request }) => {
        await request.post("/inject/seedCustomers").catch(() => undefined);
        // Give Node-RED a moment to process the inject and push the snapshot.
        // We wait on real conditions in each test, so this tiny yield is just
        // to let the flow finish before Playwright opens the next page.
    });

    // ── P30 contract ──────────────────────────────────────────────────────────

    test("the runtime reports raw events, never an actionId (P30 contract)", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;
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

    // ── HOME → LIST navigation (previously dead "Go to customers" control) ────

    test("HOME: 'Go to customers' navigates to the list from the app root", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/");
        await streamRequested;

        // Wait for the home route content to be visible
        await expect(page.getByRole("button", { name: "Go to customers" })).toBeVisible();

        // Click navigates to /customers — wait for the URL change
        const eventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Go to customers" }).click();
        await eventResponse;

        // The browser follows the navigate command
        await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
        await expect(page.locator("table.webapp-table")).toBeVisible({ timeout: 10000 });
    });

    // ── LIST: seeded rows visible ─────────────────────────────────────────────

    test("LIST: the seeded customers appear in the table", async ({ page }) => {
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

    // ── CREATE ────────────────────────────────────────────────────────────────

    test("CREATE: New → fill → Save adds a row and closes the dialog", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;
        await expect(page.locator("table.webapp-table")).toBeVisible();

        // Click "New customer" and wait for the event to be processed
        const newEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "New customer" }).click();
        await newEventResponse;

        // Wait for the dialog to appear (driven by SSE snapshot push)
        const dialog = page.locator(".webapp-dialog");
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // Fill the form fields
        await dialog.getByRole("textbox", { name: "Name" }).fill("Margaret Hamilton");
        await dialog.getByRole("textbox", { name: "Email" }).fill("margaret@example.com");
        await dialog.getByRole("textbox", { name: "Status" }).fill("active");

        // Save and wait for the response
        const saveEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await dialog.getByRole("button", { name: "Save" }).click();
        await saveEventResponse;

        // The wired save function pushes the new list (SSE snapshot) and closes the dialog
        await expect(page.locator("table.webapp-table")).toContainText("Margaret Hamilton", {
            timeout: 10000
        });
        await expect(dialog).toBeHidden({ timeout: 10000 });
    });

    // ── Native dialog dismissal (P64) ──────────────────────────────────────────

    test("CLOSE: pressing Escape on the native dialog emits onClose and closes it", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;
        await expect(page.locator("table.webapp-table")).toBeVisible();

        // Open the editor dialog.
        const newEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "New customer" }).click();
        await newEventResponse;

        const dialog = page.locator(".webapp-dialog");
        await expect(dialog).toBeVisible({ timeout: 10000 });
        // The dialog renders as a native <sl-dialog>, not bespoke chrome.
        await expect(dialog).toHaveJSProperty("tagName", "SL-DIALOG");

        // Native ESC dismissal → client fires onClose → server flips
        // ui.dialogs.customerEditor.open=false → snapshot push removes the dialog.
        const closeEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") &&
            res.request().method() === "POST" &&
            (res.request().postData() || "").includes("\"onClose\"")
        );
        await dialog.getByRole("textbox", { name: "Name" }).focus();
        await page.keyboard.press("Escape");
        await closeEventResponse;

        await expect(dialog).toBeHidden({ timeout: 10000 });
    });

    // ── READ ──────────────────────────────────────────────────────────────────

    test("READ: clicking a row navigates to that customer's detail route", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;

        // Wait for table rows to be hydrated (links must be visible)
        await expect(page.getByRole("link", { name: "Grace Hopper" })).toBeVisible();

        const rowClickResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("link", { name: "Grace Hopper" }).click();
        await rowClickResponse;

        await expect(page).toHaveURL(/\/customers\/c-200/, { timeout: 10000 });
        await expect(page.getByRole("button", { name: "Back to customers" })).toBeVisible();
    });

    // ── BACK navigation (previously dead "Back" control) ─────────────────────

    test("BACK: 'Back to customers' on the detail route returns to the list", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;

        // Navigate to detail
        await expect(page.getByRole("link", { name: "Ada Lovelace" })).toBeVisible();
        const rowClickResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("link", { name: "Ada Lovelace" }).click();
        await rowClickResponse;
        await expect(page).toHaveURL(/\/customers\/c-100/, { timeout: 10000 });

        // Click Back and wait for the navigate command to be processed
        const backEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Back to customers" }).click();
        await backEventResponse;

        // The navigate SSE command sends us back to /customers
        await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
        await expect(page.locator("table.webapp-table")).toBeVisible({ timeout: 10000 });
    });

    // ── UPDATE ────────────────────────────────────────────────────────────────

    test("UPDATE: open editor on existing row, form is pre-filled, change a field, row updates in place", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;

        // Navigate to Ada's detail
        await expect(page.getByRole("link", { name: "Ada Lovelace" })).toBeVisible();
        const rowClickResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("link", { name: "Ada Lovelace" }).click();
        await rowClickResponse;
        await expect(page).toHaveURL(/\/customers\/c-100/, { timeout: 10000 });

        // Open the editor
        const editEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Edit customer" }).click();
        await editEventResponse;

        // Wait for the dialog
        const dialog = page.locator(".webapp-dialog");
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // The form must be pre-filled with Ada's current values
        await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Ada Lovelace", { timeout: 5000 });
        await expect(dialog.getByRole("textbox", { name: "Email" })).toHaveValue("ada@example.com");
        await expect(dialog.getByRole("textbox", { name: "Status" })).toHaveValue("active");

        // Change the status field
        await dialog.getByRole("textbox", { name: "Status" }).fill("premium");

        // Save
        const saveEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await dialog.getByRole("button", { name: "Save" }).click();
        await saveEventResponse;

        // Dialog closes
        await expect(dialog).toBeHidden({ timeout: 10000 });

        // Navigate back to the list and verify Ada's row updated IN PLACE (not appended)
        await page.goto("/webapp/customersApp/customers");
        const stream2 = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await stream2;
        const table = page.locator("table.webapp-table");
        await expect(table).toBeVisible();
        // Should have Ada with updated status "premium", still only one Ada row
        await expect(table).toContainText("Ada Lovelace");
        await expect(table).toContainText("premium");
        // Count rows: still 3 (not 4 if wrongly appended)
        const rows = table.locator("tbody tr");
        await expect(rows).toHaveCount(3, { timeout: 10000 });
    });

    // ── DELETE ────────────────────────────────────────────────────────────────

    test("DELETE: removing a customer from the detail page returns to a list without it", async ({ page }) => {
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/customers");
        await streamRequested;

        // Navigate to Radia's detail
        await expect(page.getByRole("link", { name: "Radia Perlman" })).toBeVisible();
        const rowClickResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("link", { name: "Radia Perlman" }).click();
        await rowClickResponse;
        await expect(page).toHaveURL(/\/customers\/c-300/, { timeout: 10000 });

        // Delete from the detail page
        await expect(page.getByRole("button", { name: "Delete customer" })).toBeVisible();
        const deleteEventResponse = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Delete customer" }).click();
        await deleteEventResponse;

        // The flow navigates back to the list and removes the row
        await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
        await expect(page.locator("table.webapp-table")).not.toContainText("Radia Perlman", {
            timeout: 10000
        });
    });

    // ── FULL JOURNEY ──────────────────────────────────────────────────────────

    test("FULL JOURNEY: home → list → create → read → update → delete", async ({ page }) => {
        // 1. Start at the app root
        const stream1 = page.waitForRequest((req) =>
            req.url().includes("/webapp/customersApp/stream")
        );
        await page.goto("/webapp/customersApp/");
        await stream1;
        await expect(page.getByRole("button", { name: "Go to customers" })).toBeVisible();

        // 2. Navigate to the list
        const goEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Go to customers" }).click();
        await goEvent;
        await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
        await expect(page.locator("table.webapp-table")).toBeVisible({ timeout: 10000 });
        await expect(page.locator("table.webapp-table")).toContainText("Ada Lovelace");

        // 3. CREATE
        const newEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "New customer" }).click();
        await newEvent;
        const dialog = page.locator(".webapp-dialog");
        await expect(dialog).toBeVisible({ timeout: 10000 });
        await dialog.getByRole("textbox", { name: "Name" }).fill("Margaret Hamilton");
        await dialog.getByRole("textbox", { name: "Email" }).fill("margaret@example.com");
        await dialog.getByRole("textbox", { name: "Status" }).fill("active");
        const saveEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await dialog.getByRole("button", { name: "Save" }).click();
        await saveEvent;
        await expect(dialog).toBeHidden({ timeout: 10000 });
        await expect(page.locator("table.webapp-table")).toContainText("Margaret Hamilton", { timeout: 10000 });

        // 4. READ: click Grace Hopper row
        const readEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("link", { name: "Grace Hopper" }).click();
        await readEvent;
        await expect(page).toHaveURL(/\/customers\/c-200/, { timeout: 10000 });
        await expect(page.getByRole("button", { name: "Back to customers" })).toBeVisible();

        // 5. UPDATE: open editor, change status, save
        const editEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Edit customer" }).click();
        await editEvent;
        const editDialog = page.locator(".webapp-dialog");
        await expect(editDialog).toBeVisible({ timeout: 10000 });
        await expect(editDialog.getByRole("textbox", { name: "Name" })).toHaveValue("Grace Hopper", { timeout: 5000 });
        await editDialog.getByRole("textbox", { name: "Status" }).fill("active");
        const updateSaveEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await editDialog.getByRole("button", { name: "Save" }).click();
        await updateSaveEvent;
        await expect(editDialog).toBeHidden({ timeout: 10000 });

        // 6. BACK to the list
        const backEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Back to customers" }).click();
        await backEvent;
        await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });

        // 7. DELETE Ada
        const deleteNavEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("link", { name: "Ada Lovelace" }).click();
        await deleteNavEvent;
        await expect(page).toHaveURL(/\/customers\/c-100/, { timeout: 10000 });
        const deleteEvent = page.waitForResponse((res) =>
            res.url().includes("/webapp/customersApp/event") && res.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Delete customer" }).click();
        await deleteEvent;
        await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
        await expect(page.locator("table.webapp-table")).not.toContainText("Ada Lovelace", { timeout: 10000 });
    });
});

// ── Structural guard ──────────────────────────────────────────────────────────
// These tests run against the flow JSON directly (no browser) to ensure that
// no interactive control is left unwired and no ui-action node is orphaned.
// A green suite here means the full-journey tests above cannot silently skip
// dead controls because the example grows stale.

test.describe("structural guard — examples/customers-crud/flow.json @integration", () => {
    const FLOW_PATH = resolve(__dirname, "../../examples/customers-crud/flow.json");

    function loadFlow(): unknown[] {
        return JSON.parse(readFileSync(FLOW_PATH, "utf8")) as unknown[];
    }

    test("no ui-button or ui-table node has an empty output wire", () => {
        const flow = loadFlow();
        const deadControls: string[] = [];

        for (const node of flow) {
            const n = node as Record<string, unknown>;
            if (n.type !== "ui-button" && n.type !== "ui-table") {
                continue;
            }

            const wires = n.wires as unknown[][];
            if (!wires || wires.length === 0) {
                deadControls.push(`${String(n.id)} (${String(n.type)}): no wires at all`);
                continue;
            }

            // Every output port must have at least one target
            for (let portIdx = 0; portIdx < wires.length; portIdx++) {
                const port = wires[portIdx];
                if (!port || (port as string[]).length === 0) {
                    deadControls.push(
                        `${String(n.id)} (${String(n.type)}): port ${portIdx} is empty`
                    );
                }
            }
        }

        if (deadControls.length > 0) {
            throw new Error(
                `Dead interactive controls found (empty output wires):\n  ${deadControls.join("\n  ")}`
            );
        }
    });

    test("no ui-action node is orphaned (every action has a feeder)", () => {
        const flow = loadFlow();

        // Collect all wire targets across the whole flow
        const allWireTargets = new Set<string>();
        for (const node of flow) {
            const n = node as Record<string, unknown>;
            const wires = n.wires as string[][] | undefined;
            if (wires) {
                for (const port of wires) {
                    for (const target of port) {
                        allWireTargets.add(target);
                    }
                }
            }
        }

        const orphans: string[] = [];

        for (const node of flow) {
            const n = node as Record<string, unknown>;
            if (n.type !== "ui-action") {
                continue;
            }

            // P64: the dialog-close action self-source exemption is gone. The
            // native <sl-dialog> X / ESC / overlay dismissal closes the dialog
            // (onClose → server flips ui.dialogs.<id>.open=false). There is no
            // hard-coded Close link any more, so EVERY ui-action must have a feeder.
            if (!allWireTargets.has(String(n.id))) {
                orphans.push(`${String(n.id)} (${String(n.uiId)}): no feeder`);
            }
        }

        if (orphans.length > 0) {
            throw new Error(`Orphaned ui-action nodes found:\n  ${orphans.join("\n  ")}`);
        }
    });

    test("the hard-coded closeCustomerEditor action is gone (P64 native dismissal)", () => {
        const flow = loadFlow();
        const hasCloseAction = flow.some(
            (node) =>
                typeof node === "object" &&
                node !== null &&
                (node as Record<string, unknown>).uiId === "closeCustomerEditor"
        );
        expect(hasCloseAction).toBe(false);
    });
});

// ── Dev/E2E parity guard ──────────────────────────────────────────────────────
// Ensure examples/customers-crud/flow.json matches the current gen-example.js
// output so the generated example and the checked-in JSON stay in sync.

test.describe("dev/E2E parity — gen-example.js output matches flow.json @integration", () => {
    test("examples/customers-crud/flow.json matches pnpm gen:example output", () => {
        const FLOW_PATH = resolve(__dirname, "../../examples/customers-crud/flow.json");
        const ROOT = resolve(__dirname, "../..");

        // Run gen-example.js and capture stdout; it writes to a temp copy in the
        // same path, so capture the current on-disk content BEFORE re-running.
        const before = readFileSync(FLOW_PATH, "utf8");

        try {
            execSync("node scripts/gen-example.js", { cwd: ROOT, stdio: "pipe" });
        } catch (err) {
            throw new Error(`gen-example.js failed: ${String(err)}`);
        }

        const after = readFileSync(FLOW_PATH, "utf8");

        if (before !== after) {
            throw new Error(
                "examples/customers-crud/flow.json is out of sync with gen-example.js.\n" +
                "Run 'pnpm gen:example' and commit the result."
            );
        }
    });
});
