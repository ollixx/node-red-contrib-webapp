import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P224 (ADR 0037) — Dynamic-State-Field Foundation.
 *
 * A component's visibility is ONE value, written through the unified API
 * (`setDynamicStateField`, reached here via `msg.ui.dynamicState`, honouring
 * `msg.ui.clientId`):
 *   - UNBOUND `ui-alert.visible` → an internal per-client slot. Set false → the
 *     alert disappears; true → it re-appears. Two clients are ISOLATED.
 *   - BOUND `visible` (a ui-store) → the write goes THROUGH to the store, so the
 *     STORE value changes (a second store-bound text follows) and the re-render
 *     tracks it.
 *
 * Proven on real DOM visibility (attached/visible vs detached/hidden), and the
 * bound case additionally on the store's own rendered value — not on tags/classes.
 */

type FlowNode = Record<string, unknown>;

async function loadFlow(rel: string): Promise<FlowNode[]> {
    return JSON.parse(await readFile(path.resolve(process.cwd(), rel), "utf8")) as FlowNode[];
}

// Distinct, non-overlapping messages so each filter matches exactly one alert.
const unboundAlert = (root: ReturnType<typeof rootOf>) => root.locator("sl-alert").filter({ hasText: "Slot alert" });
const boundAlert = (root: ReturnType<typeof rootOf>) => root.locator("sl-alert").filter({ hasText: "Store alert" });

function rootOf(page: import("@playwright/test").Page) {
    return page.locator("#webapp-client-root");
}

async function connect(page: import("@playwright/test").Page): Promise<void> {
    const stream = page.waitForResponse((res) => res.url().includes("/webapp/p224App/stream"));
    await page.goto("/webapp/p224App/");
    await expect(rootOf(page)).toBeVisible();
    await stream;
    await page.waitForTimeout(300);
}

test.describe("dynamic-state field foundation (P224)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlow("tests/e2e/fixtures/p224-dynamic-state.flow.json");
        expect((await request.post("/flows", { data: flow })).ok()).toBeTruthy();
    });

    test.afterAll(async ({ request }) => {
        const baseline = await loadFlow("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("UNBOUND visible: the API toggles the alert off and on", async ({ page }) => {
        await connect(page);
        const root = rootOf(page);

        // Default (no writer) → neutral visible.
        await expect(unboundAlert(root)).toBeVisible();

        // Set false via the API → the alert disappears.
        await page.getByRole("button", { name: "Hide Unbound" }).click();
        await expect(unboundAlert(root)).toBeHidden({ timeout: 10000 });

        // Set true → it re-appears.
        await page.getByRole("button", { name: "Show Unbound" }).click();
        await expect(unboundAlert(root)).toBeVisible({ timeout: 10000 });
    });

    test("BOUND visible: the API writes THROUGH to the store (value + re-render follow)", async ({ page }) => {
        await connect(page);
        const root = rootOf(page);

        // The store starts true → the bound alert shows and the store-bound text reads "true".
        await expect(boundAlert(root)).toBeVisible();
        await expect(root.locator(".webapp-text").filter({ hasText: "true" })).toBeVisible();

        // Set the BOUND visible false → the store value flips (durchgeschrieben) and
        // the bound alert hides.
        await page.getByRole("button", { name: "Hide Bound" }).click();
        await expect(root.locator(".webapp-text").filter({ hasText: "false" })).toBeVisible({ timeout: 10000 });
        await expect(boundAlert(root)).toBeHidden({ timeout: 10000 });
    });

    test("per-client isolation: one client's unbound hide does NOT affect another", async ({ browser }) => {
        const contextA = await browser.newContext();
        const contextB = await browser.newContext();
        const pageA = await contextA.newPage();
        const pageB = await contextB.newPage();

        await connect(pageA);
        await connect(pageB);
        const rootA = rootOf(pageA);
        const rootB = rootOf(pageB);

        await expect(unboundAlert(rootA)).toBeVisible();
        await expect(unboundAlert(rootB)).toBeVisible();

        // Client A hides its unbound alert (the write carries A's clientId).
        await pageA.getByRole("button", { name: "Hide Unbound" }).click();
        await expect(unboundAlert(rootA)).toBeHidden({ timeout: 10000 });

        // Client B is unaffected — the internal slot is per-client, not global.
        await expect(unboundAlert(rootB)).toBeVisible();

        await contextA.close();
        await contextB.close();
    });
});
