import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type FlowNode = Record<string, unknown>;

async function loadCustomersFlowFixture(): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), "examples/customers-crud/flow.json");
    const fixtureContent = await readFile(fixturePath, "utf8");
    return JSON.parse(fixtureContent) as FlowNode[];
}

async function deployFlow(request: Parameters<typeof test>[0]["request"], flow: FlowNode[]): Promise<void> {
    const response = await request.post("/flows", {
        data: flow
    });
    expect(response.ok()).toBeTruthy();
}

test.describe("editor flow integrity regression", () => {
    let baselineFlow: FlowNode[];

    test.beforeAll(async () => {
        baselineFlow = await loadCustomersFlowFixture();
    });

    test.beforeEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    test.afterEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    test("does not show recovery warning in editor for a valid customers flow", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // A valid flow must not trigger recovered/restored warnings in the editor.
        await expect(page.locator("body")).not.toContainText(/Wiederhergestellte|Recovered|restored|Flow"[0-9a-f]{8,}/i);
    });
});
