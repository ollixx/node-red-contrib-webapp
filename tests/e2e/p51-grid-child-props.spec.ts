import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { pickMountInTree } from "../helpers/picker-dialog";

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

async function openEditor(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await waitForEditorNode(page, nodeId);
    await page.evaluate((id) => {
        const node = RED.nodes.node(id);
        RED.editor.edit(node);
    }, nodeId);
    await page.waitForTimeout(300);
}

test.describe("P51: grid child prop positive-integer validation in editor", () => {
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

    test("col input has min=1 and step=1 attributes after switching to grid mount", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        await openEditor(page, "mountTextNode");

        // Switch to a grid layout mount so the col field becomes visible
        // P114 / ADR 0009: switch the mount to a grid layout through the picker
        // dialog (the mount field is dialog-only now) so the col field appears.
        await pickMountInTree(page, "mount", { nodeText: "Grid Layout Demo", slotText: "content", expectValue: "mountGridApp.content" });
        await page.waitForTimeout(150);

        const colInput = page.locator("#node-input-col");
        await expect(colInput).toHaveAttribute("min", "1");
        await expect(colInput).toHaveAttribute("step", "1");

        const rowInput = page.locator("#node-input-row");
        await expect(rowInput).toHaveAttribute("min", "1");
        await expect(rowInput).toHaveAttribute("step", "1");
    });

    test("node is flagged invalid when col=0 is entered", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        await openEditor(page, "mountTextNode");

        // Switch to grid mount so col becomes visible
        // P114 / ADR 0009: switch the mount to a grid layout through the picker
        // dialog (the mount field is dialog-only now) so the col field appears.
        await pickMountInTree(page, "mount", { nodeText: "Grid Layout Demo", slotText: "content", expectValue: "mountGridApp.content" });
        await page.waitForTimeout(150);

        // Enter invalid value 0 into col and trigger blur
        await page.fill("#node-input-col", "0");
        await page.locator("#node-input-col").press("Tab");
        await page.waitForTimeout(100);

        // Node-RED validate() runs when the input changes. Check via RED API that
        // the node is now considered invalid (validate fn returns false for 0).
        const isValid = await page.evaluate(() => {
            // Access the node being edited — RED.editor stores it on the tray
            const node = RED.editor.getEditStack?.()?.at(-1) ?? RED.editor._editing;
            if (!node) {
                // Fallback: check the col field directly using RED.nodes
                let found = false;
                RED.nodes.eachNode(function(n) {
                    if (n.id === "mountTextNode") { found = n; }
                });
                if (!found) return null;
                const validate = found._def?.defaults?.col?.validate;
                if (typeof validate !== "function") return null;
                return validate("0");
            }
            const validate = node._def?.defaults?.col?.validate;
            if (typeof validate !== "function") return null;
            return validate("0");
        });

        // The validate function should return false for "0" (non-positive)
        expect(isValid).toBe(false);
    });

    test("node is valid when col=1 is entered", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        await openEditor(page, "mountTextNode");

        // P114 / ADR 0009: switch the mount to a grid layout through the picker
        // dialog (the mount field is dialog-only now) so the col field appears.
        await pickMountInTree(page, "mount", { nodeText: "Grid Layout Demo", slotText: "content", expectValue: "mountGridApp.content" });
        await page.waitForTimeout(150);

        await page.fill("#node-input-col", "1");
        await page.locator("#node-input-col").press("Tab");
        await page.waitForTimeout(100);

        const colInput = page.locator("#node-input-col");
        await expect(colInput).not.toHaveClass(/input-error/);
    });
});
