import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P115 (ADR 0010) — `reactive` binding, end-to-end.
 *
 * A ui-text on a route `/customers/:id` whose `value` binding is
 * `{ kind: "reactive", value: "`Kunde ${routeParam.id}`" }`. The renderer
 * compiles and evaluates the expression per snapshot, so the composed text is
 * correct on deep link, on navigation, and on refresh — per client, with no
 * backend nodes and no clientId routing.
 *
 * A dedicated fixture flow is used (NOT customers-crud) so the assertions are
 * independent of the example's own wiring.
 */

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const content = await readFile(fixturePath, "utf8");
    return JSON.parse(content) as FlowNode[];
}

test.describe("reactive binding (P115)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/reactive-binding.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    // Restore the customers-crud baseline so later specs that depend on
    // customersApp are not left with the reactiveApp fixture flow.
    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("deep-link to /customers/42 shows the composed reactive text", async ({ page }) => {
        await page.goto("/webapp/reactiveApp/customers/42");
        await expect(page.locator(".webapp-text")).toContainText("Kunde 42");
    });

    test("navigating to a different :id re-evaluates the expression to the new param", async ({ page }) => {
        await page.goto("/webapp/reactiveApp/customers/42");
        await expect(page.locator(".webapp-text")).toContainText("Kunde 42");

        // In this app every route navigation is a real browser navigation
        // (the client does window.location.assign; the SSE stream carries live
        // data, not route swaps). Navigating to a new :id produces a fresh
        // snapshot in which the reactive expression re-evaluates against the new
        // route param — no backend nodes, no clientId routing.
        await page.goto("/webapp/reactiveApp/customers/7");
        await expect(page.locator(".webapp-text")).toContainText("Kunde 7");
    });

    test("reload on /customers/7 still shows Kunde 7", async ({ page }) => {
        await page.goto("/webapp/reactiveApp/customers/7");
        await expect(page.locator(".webapp-text")).toContainText("Kunde 7");

        await page.reload();
        await expect(page.locator(".webapp-text")).toContainText("Kunde 7");
    });
});
