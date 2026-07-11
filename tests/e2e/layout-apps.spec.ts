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

    test("renders vertical, horizontal, app, grid and absolute layouts as modeled", async ({ page }) => {
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

        await page.goto("/webapp/layoutGridApp");
        await expect(page.locator(".webapp-slot-body--grid")).toHaveCount(1);
        await expect(page.locator(".webapp-item--grid").first()).toHaveAttribute("style", /grid-column:1 \/ span 4/);
        await expect(page.locator("text=Grid A")).toBeVisible();
        await expect(page.locator("text=Grid B")).toBeVisible();
        await expect(page.getByText("Node messages")).toHaveCount(0);
        await expect(page.getByText("Snapshot")).toHaveCount(0);

        await page.goto("/webapp/layoutAbsoluteApp");
        await expect(page.locator(".webapp-slot-body--absolute")).toHaveCount(1);
        await expect(page.locator(".webapp-item--absolute").first()).toHaveAttribute("style", /left:24px/);
        await expect(page.locator("text=Absolute A")).toBeVisible();
        await expect(page.locator("text=Absolute B")).toBeVisible();
        await expect(page.getByText("Node messages")).toHaveCount(0);
        await expect(page.getByText("Snapshot")).toHaveCount(0);
    });

    // P207: order defaults to canvas y when order is empty. Measured proof —
    // DOM order (not tag/class) of the two order-less ui-text nodes in the
    // same vertical slot must follow their canvas y-position, and swapping
    // which node has the smaller y swaps which text renders first.
    test("order-less nodes render in canvas-y order; swapping y swaps the render order", async ({ page }) => {
        await page.goto("/webapp/layoutOrderYApp");
        const contentTexts = page.locator(".webapp-slot--content [data-webapp-node]");
        await expect(contentTexts).toHaveCount(2);
        // layoutOrderYSmallY (y=1040) has no `order` field and a smaller canvas y
        // than layoutOrderYLargeY (y=1200) — it must render first.
        await expect.poll(() => contentTexts.allTextContents()).toEqual([
            "Order Y small-y",
            "Order Y large-y"
        ]);
        const firstBox = await contentTexts.nth(0).boundingBox();
        const secondBox = await contentTexts.nth(1).boundingBox();
        expect(firstBox).not.toBeNull();
        expect(secondBox).not.toBeNull();
        expect(firstBox!.y).toBeLessThan(secondBox!.y);

        // layoutOrderYSwappedApp has the SAME two order-less texts, but with the
        // canvas y-positions swapped relative to layoutOrderYApp — the smaller-y
        // node here is the one labelled "Order Y large-y", proving that swapping
        // y swaps which text renders first.
        await page.goto("/webapp/layoutOrderYSwappedApp");
        const swappedTexts = page.locator(".webapp-slot--content [data-webapp-node]");
        await expect(swappedTexts).toHaveCount(2);
        await expect.poll(() => swappedTexts.allTextContents()).toEqual([
            "Order Y large-y",
            "Order Y small-y"
        ]);
    });

    // P207: mixed slot — an explicit `order` still wins over a y-fallback
    // sibling, even when the y-fallback node's canvas y-position is much
    // smaller in pixel terms than the explicit order value would suggest.
    test("explicit order sorts before a y-fallback sibling (mixed slot)", async ({ page }) => {
        await page.goto("/webapp/layoutOrderMixedApp");
        const mixedTexts = page.locator(".webapp-slot--content [data-webapp-node]");
        await expect(mixedTexts).toHaveCount(2);
        // layoutOrderMixedExplicit has order=5 (and canvas y=1900);
        // layoutOrderMixedYFallback has no order and canvas y=120 (5 < 120).
        await expect.poll(() => mixedTexts.allTextContents()).toEqual([
            "Order Mixed explicit-order",
            "Order Mixed y-fallback"
        ]);
        const firstBox = await mixedTexts.nth(0).boundingBox();
        const secondBox = await mixedTexts.nth(1).boundingBox();
        expect(firstBox).not.toBeNull();
        expect(secondBox).not.toBeNull();
        expect(firstBox!.y).toBeLessThan(secondBox!.y);
    });
});