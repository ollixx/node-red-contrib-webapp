import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type FlowNode = Record<string, unknown>;

async function loadFlowFixture(relativePath: string): Promise<FlowNode[]> {
    const fixturePath = path.resolve(process.cwd(), relativePath);
    const content = await readFile(fixturePath, "utf8");
    return JSON.parse(content) as FlowNode[];
}

async function deployFlow(request: Parameters<typeof test>[0]["request"], flow: FlowNode[]): Promise<void> {
    const response = await request.post("/flows", { data: flow });
    expect(response.ok()).toBeTruthy();
}

async function waitForEditorNode(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await page.waitForFunction((id) => {
        const nodeApi = (window as typeof window & { RED?: { nodes?: { node: (nodeId: string) => unknown } } }).RED?.nodes;
        return typeof nodeApi?.node === "function" && nodeApi.node(id) !== undefined;
    }, nodeId);
}

async function openEditor(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await waitForEditorNode(page, nodeId);
    await page.evaluate((id) => {
        const node = RED.nodes.node(id);
        RED.editor.edit(node);
    }, nodeId);
    await page.waitForTimeout(300);
}


test.describe("P16d: display nodes editor", () => {
    let displayFlow: FlowNode[];
    let baselineFlow: FlowNode[];

    test.beforeAll(async () => {
        displayFlow = await loadFlowFixture("tests/e2e/fixtures/p16d-display-nodes.flow.json");
        baselineFlow = await loadFlowFixture("examples/customers-crud/flow.json");
    });

    test.beforeEach(async ({ request }) => {
        await deployFlow(request, displayFlow);
    });

    test.afterEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    test("ui-image editor shows parent selector and default name", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await openEditor(page, "p16dImage");

        const mountSelect = await page.locator("#node-input-mount").isVisible();
        expect(mountSelect).toBe(true);

        const nameValue = await page.inputValue("#node-input-name");
        expect(nameValue.length).toBeGreaterThan(0);

        // Editor is closed by the next test's page.goto("/") navigation.
    });

    test("ui-icon editor shows parent selector and default name", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await openEditor(page, "p16dIcon");

        const mountSelect = await page.locator("#node-input-mount").isVisible();
        expect(mountSelect).toBe(true);

        const nameValue = await page.inputValue("#node-input-name");
        expect(nameValue.length).toBeGreaterThan(0);

        // Editor is closed by the next test's page.goto("/") navigation.
    });

    test("ui-list editor shows parent selector and default name", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await openEditor(page, "p16dList");

        const mountSelect = await page.locator("#node-input-mount").isVisible();
        expect(mountSelect).toBe(true);

        const nameValue = await page.inputValue("#node-input-name");
        expect(nameValue.length).toBeGreaterThan(0);

        // Editor is closed by the next test's page.goto("/") navigation.
    });

    test("ui-avatar editor shows parent selector and default name", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await openEditor(page, "p16dAvatar");

        const mountSelect = await page.locator("#node-input-mount").isVisible();
        expect(mountSelect).toBe(true);

        const nameValue = await page.inputValue("#node-input-name");
        expect(nameValue.length).toBeGreaterThan(0);

        // Editor is closed by the next test's page.goto("/") navigation.
    });

    test("ui-divider editor shows parent selector and default name", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await openEditor(page, "p16dDivider");

        const mountSelect = await page.locator("#node-input-mount").isVisible();
        expect(mountSelect).toBe(true);

        const nameValue = await page.inputValue("#node-input-name");
        expect(nameValue.length).toBeGreaterThan(0);

        // Editor is closed by the next test's page.goto("/") navigation.
    });
});
