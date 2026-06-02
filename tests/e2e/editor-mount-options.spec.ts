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

async function waitForEditorNode(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await page.waitForFunction((id) => {
        const nodeApi = (window as typeof window & { RED?: { nodes?: { node: (nodeId: string) => unknown } } }).RED?.nodes;
        return typeof nodeApi?.node === "function" && nodeApi.node(id) !== undefined;
    }, nodeId);
}

async function readMountOptions(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await waitForEditorNode(page, nodeId);
    await page.evaluate((id) => {
        const node = RED.nodes.node(id);
        RED.editor.edit(node);
    }, nodeId);
    await page.waitForTimeout(300);

    // Return option VALUES (e.g. "mountAppShellDemo.content") — values uniquely
    // identify mount targets regardless of the display label format used by the
    // tree select (which shows slot names without app name context).
    return page.evaluate(() => {
        const select = document.querySelector<HTMLSelectElement>("#node-input-mount");
        return select ? Array.from(select.options).map((option) => option.value).filter((v) => v !== "") : [];
    });
}

async function openEditor(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await waitForEditorNode(page, nodeId);
    await page.evaluate((id) => {
        const node = RED.nodes.node(id);
        RED.editor.edit(node);
    }, nodeId);
    await page.waitForTimeout(300);
}

async function readVisibleLayoutChildRows(page: Parameters<typeof test>[0]["page"]) {
    return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("[data-layout-child-prop-row]"))
        .filter((element) => window.getComputedStyle(element).display !== "none")
        .map((element) => element.getAttribute("data-layout-child-prop-row")));
}

test.describe("editor mount option coverage", () => {
    let baselineFlow: FlowNode[];
    let mountFlow: FlowNode[];

    test.beforeAll(async () => {
        baselineFlow = await loadFlowFixture("examples/customers-crud/flow.json");
        mountFlow = await loadFlowFixture("tests/e2e/fixtures/editor-mount-options.flow.json");
    });

    test.beforeEach(async ({ request }) => {
        await deployFlow(request, mountFlow);
    });

    test.afterEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    test("shows all valid app slots for mount-based nodes", async ({ page }) => {
        // Option VALUES encode the mount target as "<appId>.<slot>" or
        // "route:<path>/<slot>" — these are the canonical identifiers regardless of
        // the display label used by the tree-select widget.
        const expectedOptions = [
            "mountAbsoluteApp.content",
            "mountAppShellDemo.content",
            "mountAppShellDemo.footer",
            "mountAppShellDemo.header",
            "mountAppShellDemo.navbar",
            "mountGridApp.content",
            "mountHorizontalApp.content",
            "mountVerticalApp.content"
        ];

        await page.goto("/");
        await page.waitForLoadState("networkidle");

        for (const nodeId of ["mountTextNode", "mountButtonNode", "mountInputNode", "mountContainerNode"]) {
            const options = await readMountOptions(page, nodeId);
            expect(options).toEqual(expect.arrayContaining(expectedOptions));
        }
    });

    test("shows layout-specific child fields for direct mounts", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await openEditor(page, "mountTextNode");

        expect(await readVisibleLayoutChildRows(page)).toEqual(["order"]);

        await page.selectOption("#node-input-mount", "mountHorizontalApp.content");
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual(["order"]);

        await page.selectOption("#node-input-mount", "mountGridApp.content");
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual(["row", "col", "colSize", "rowSize"]);

        await page.selectOption("#node-input-mount", "mountAbsoluteApp.content");
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual(["layoutX", "layoutY"]);

        await page.selectOption("#node-input-mount", "mountAppShellDemo.content");
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual([]);
    });
});