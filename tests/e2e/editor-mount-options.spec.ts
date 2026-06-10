import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { pickReference } from "../helpers/picker-dialog";

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

/**
 * P114 / ADR 0009: the mount field is the dialog-only picker. The candidate
 * mount targets are produced by the `mounts` preset (flatten of the option tree
 * into breadcrumb-labelled, mount-valued entries) — there is no native mount
 * `<select>` to read options from anymore. We assert the preset's VALUES (the
 * canonical "<appId>.<slot>" / "route:<path>/<slot>" identifiers) for the node
 * currently being edited.
 */
async function readMountOptionValues(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await waitForEditorNode(page, nodeId);
    await page.evaluate((id) => {
        const node = RED.nodes.node(id);
        RED.editor.edit(node);
    }, nodeId);
    await page.waitForTimeout(300);

    return page.evaluate(() => {
        const C = (window as unknown as { WebappEditorCommon: { nodePickerOptionsForPreset: (p: string) => Array<{ value: string }> } }).WebappEditorCommon;
        return C.nodePickerOptionsForPreset("mounts").map((o) => o.value).filter((v) => v !== "");
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

    test("mounts preset offers all valid app slots for mount-based nodes", async ({ page }) => {
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
            const options = await readMountOptionValues(page, nodeId);
            expect(options).toEqual(expect.arrayContaining(expectedOptions));
        }
    });

    test("layout-specific child fields follow the parent picked in the mount dialog", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");
        await openEditor(page, "mountTextNode");

        // mountTextNode starts mounted to a vertical app → only `order`.
        expect(await readVisibleLayoutChildRows(page)).toEqual(["order"]);

        // Pick a horizontal-app slot via the dialog → still `order`.
        await pickReference(page, "mount", { search: "mountHorizontalApp.content", expectValue: "mountHorizontalApp.content" });
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual(["order"]);

        // Pick a grid-app slot → row/col/colSize/rowSize.
        await pickReference(page, "mount", { search: "mountGridApp.content", expectValue: "mountGridApp.content" });
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual(["row", "col", "colSize", "rowSize"]);

        // Pick an absolute-app slot → layoutX/layoutY.
        await pickReference(page, "mount", { search: "mountAbsoluteApp.content", expectValue: "mountAbsoluteApp.content" });
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual(["layoutX", "layoutY"]);

        // Pick an app-shell slot (app layout has no child-placement fields) → none.
        await pickReference(page, "mount", { search: "mountAppShellDemo.content", expectValue: "mountAppShellDemo.content" });
        await page.waitForTimeout(100);
        expect(await readVisibleLayoutChildRows(page)).toEqual([]);
    });
});
