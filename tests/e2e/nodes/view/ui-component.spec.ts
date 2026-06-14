import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * P179 (ADR 0020) — ui-component end-to-end browser proof.
 *
 * A `ui-component-definition` ("cardDef") with two `ui-text` children
 * (`text = prop.title` / `text = prop.body`) and a `ui-button` child. Two
 * `ui-component-instance`s mount into the same app slot with DIFFERENT props:
 *   - inst1: title = "Alpha", body = a store binding (`card.body`)
 *   - inst2: title = "Beta",  body = literal "Second"
 *
 * Each instance renders its own two lines with the instance-specific values; the
 * inner nodes are re-id'd `<instanceId>#<innerNodeId>` (so an inner node's event
 * carries the instance identity in its sourceId). Pushing a store update through
 * the "Update body" button live-updates ONLY inst1's body (the store-bound prop),
 * leaving inst2 untouched. The definition itself never renders on its own.
 *
 * A dedicated fixture flow is used (NOT customers-crud) so the assertions are
 * independent of the example's own wiring. The baseline is restored afterwards.
 */

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const content = await readFile(fixturePath, "utf8");
    return JSON.parse(content) as FlowNode[];
}

test.describe("ui-component definition/instance render (P179)", () => {
    test.beforeAll(async ({ request }) => {
        const flow = await loadFlowFixture("tests/e2e/fixtures/ui-component.flow.json");
        const response = await request.post("/flows", { data: flow });
        expect(response.ok()).toBeTruthy();
    });

    // Restore the customers-crud baseline so later specs that depend on
    // customersApp are not left with the component fixture flow.
    test.afterAll(async ({ request }) => {
        const baseline = await loadFlowFixture("examples/customers-crud/flow.json");
        await request.post("/flows", { data: baseline });
    });

    test("two instances render their own two lines with instance-specific prop values", async ({ page }) => {
        await page.goto("/webapp/componentsApp/");

        // inst1: title=Alpha, body=store value "First-live".
        await expect(page.locator('[data-webapp-node="inst1#cardTitle"]')).toHaveText("Alpha");
        await expect(page.locator('[data-webapp-node="inst1#cardBody"]')).toHaveText("First-live");

        // inst2: title=Beta, body=literal "Second".
        await expect(page.locator('[data-webapp-node="inst2#cardTitle"]')).toHaveText("Beta");
        await expect(page.locator('[data-webapp-node="inst2#cardBody"]')).toHaveText("Second");
    });

    test("inner nodes carry the instance identity <instanceId>#<innerNodeId>", async ({ page }) => {
        await page.goto("/webapp/componentsApp/");

        // Both instances' inner button clones exist with the instance-prefixed id —
        // the id a click event reports as its sourceId.
        await expect(page.locator('[data-webapp-node="inst1#cardCta"]')).toBeVisible();
        await expect(page.locator('[data-webapp-node="inst2#cardCta"]')).toBeVisible();

        // The off-canvas definition never renders its bare (un-prefixed) inner ids.
        await expect(page.locator('[data-webapp-node="cardTitle"]')).toHaveCount(0);
        await expect(page.locator('[data-webapp-node="cardBody"]')).toHaveCount(0);
    });

    test("a prop bound to a store updates only the affected instance live", async ({ page }) => {
        await page.goto("/webapp/componentsApp/");

        await expect(page.locator('[data-webapp-node="inst1#cardBody"]')).toHaveText("First-live");
        await expect(page.locator('[data-webapp-node="inst2#cardBody"]')).toHaveText("Second");

        // Push a store update: card.body -> "First-updated".
        await page.getByText("Update body").click();

        // inst1's store-bound body updates live; inst2 (literal body) is untouched.
        await expect(page.locator('[data-webapp-node="inst1#cardBody"]')).toHaveText("First-updated");
        await expect(page.locator('[data-webapp-node="inst2#cardBody"]')).toHaveText("Second");
        // inst1's title (literal) does not change either.
        await expect(page.locator('[data-webapp-node="inst1#cardTitle"]')).toHaveText("Alpha");
    });
});
