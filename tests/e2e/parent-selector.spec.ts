import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { gotoEditor } from "../helpers/editor-ready";
import { openPicker, pickerFieldButton } from "../helpers/picker-dialog";

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

/**
 * P114 / ADR 0009: parent and parent-slot selection is the dialog-only picker.
 * The bound `#node-input-app` / `#node-input-mount` are hidden value carriers;
 * a read-only display + "Auswählen…" button drive selection through the P68
 * dialog (apps / mounts presets). These specs assert the dialog pattern is wired
 * and the preset candidates are populated from the editor graph.
 */
test.describe("P11b/P114: parent + parent-slot pickers in editors", () => {
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

    test("ui-store parent field is the dialog picker; dialog lists app entries", async ({ page }) => {
        await gotoEditor(page);
        await openEditor(page, "mountStore");

        // Dialog-only pattern: button present, bound control hidden.
        await expect(pickerFieldButton(page, "app")).toBeVisible();
        await expect(page.locator("#node-input-app")).toBeHidden();

        // The apps preset (what the dialog renders from) has app candidates.
        const appCount = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: { nodePickerOptionsForPreset: (p: string) => unknown[] } }).WebappEditorCommon;
            return C.nodePickerOptionsForPreset("apps").length;
        });
        expect(appCount).toBeGreaterThan(0);

        // Opening the dialog shows app rows.
        await openPicker(page, "app");
        await expect(page.locator(".webapp-node-picker-row").first()).toBeVisible();
    });

    test("ui-button parent-slot field is the dialog picker; mounts preset has app slots", async ({ page }) => {
        await gotoEditor(page);
        await openEditor(page, "mountButtonNode");

        await expect(pickerFieldButton(page, "mount")).toBeVisible();
        await expect(page.locator("#node-input-mount")).toBeHidden();

        // The mounts preset contributes the fixture apps' slots.
        const mountValues = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: { nodePickerOptionsForPreset: (p: string) => Array<{ value: string }> } }).WebappEditorCommon;
            return C.nodePickerOptionsForPreset("mounts").map((o) => o.value);
        });
        const appShellEntries = mountValues.filter((v) => v.startsWith("mountAppShellDemo."));
        expect(appShellEntries.length).toBeGreaterThan(0);
    });

    test("ui-button registered type has onadd that produces a name default", async ({ page }) => {
        await gotoEditor(page);

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as { getType: (type: string) => { onadd?: () => void } | undefined }).getType?.("ui-button");
            if (!typeDef || typeof typeDef.onadd !== "function") {
                return { hasOnadd: false, name: "" };
            }

            let count = 0;
            RED.nodes.eachNode((n: { type: string }) => {
                if (n.type === "ui-button") count++;
            });

            const fakeNode: { name: string; type?: string } = { name: "" };
            typeDef.onadd.call(fakeNode);

            return { hasOnadd: true, name: fakeNode.name, expectedN: count + 1 };
        });

        expect(result.hasOnadd).toBe(true);
        expect(result.name).toBe(`Button ${result.expectedN}`);
    });
});
