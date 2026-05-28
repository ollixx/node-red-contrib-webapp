import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const fixtureContent = await readFile(fixturePath, "utf8");
    return JSON.parse(fixtureContent) as FlowNode[];
}

async function deployFlow(request: Parameters<typeof test>[0]["request"], flow: FlowNode[]): Promise<void> {
    const response = await request.post("/flows", {
        data: flow
    });
    expect(response.ok()).toBeTruthy();
}

test.describe("layout rendering", () => {
    let baselineFlow: FlowNode[];
    let demoFlow: FlowNode[];

    test.beforeAll(async () => {
        baselineFlow = await loadFlowFixture("examples/customers-crud/flow.json");
        demoFlow = [...baselineFlow, ...(await loadFlowFixture("tests/e2e/fixtures/layout-demos.flow.json"))];
    });

    test.beforeEach(async ({ request }) => {
        await deployFlow(request, demoFlow);
    });

    test.afterEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    test("renders vertical, horizontal, app and custom layouts as modeled", async ({ page }) => {
        await page.goto("/webapp/layoutVerticalApp");
        await expect(page.locator(".webapp-slot-body.webapp-slot-body--vertical")).toHaveCount(1);
        await expect(page.locator("text=Vertical item 1")).toBeVisible();
        await expect(page.locator("text=Vertical item 2")).toBeVisible();
        await expect(page.locator("text=Vertical item 3")).toBeVisible();
        await expect(page.getByText("Node messages")).toHaveCount(0);
        await expect(page.getByText("Snapshot")).toHaveCount(0);

        await page.goto("/webapp/layoutHorizontalApp");
        await expect(page.locator(".webapp-slot-body.webapp-slot-body--horizontal")).toHaveCount(1);
        await expect(page.locator("text=Horizontal item 1")).toBeVisible();
        await expect(page.locator("text=Horizontal item 2")).toBeVisible();
        await expect(page.locator("text=Horizontal item 3")).toBeVisible();
        await expect(page.getByText("Node messages")).toHaveCount(0);
        await expect(page.getByText("Snapshot")).toHaveCount(0);

        await page.goto("/webapp/layoutAppShellDemo");
        await expect(page.locator(".webapp-layout.webapp-layout--app")).toHaveCount(1);
        await expect(page.locator(".webapp-slot--header .webapp-text")).toHaveText("App header");
        await expect(page.locator(".webapp-slot--navbar .webapp-text")).toHaveText("App navigation");
        await expect(page.locator(".webapp-slot--content .webapp-text")).toHaveText("App content");
        await expect(page.getByText("Node messages")).toHaveCount(0);
        await expect(page.getByText("Snapshot")).toHaveCount(0);

        await page.goto("/webapp/layoutCustomApp");
        await expect(page.locator(".webapp-layout.webapp-layout--custom")).toHaveCount(1);
        await expect(page.locator(".webapp-slot--sidebar .webapp-text")).toHaveText("Custom sidebar");
        await expect(page.locator(".webapp-slot--main .webapp-text")).toHaveText("Custom main");
        await expect(page.locator(".webapp-slot--footer .webapp-text")).toHaveText("Custom footer");
        await expect(page.getByText("Node messages")).toHaveCount(0);
        await expect(page.getByText("Snapshot")).toHaveCount(0);
    });
});