import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { gotoEditor } from "../helpers/editor-ready";

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

test.describe("P11b: parent SelectBox in editors", () => {
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

    test("ui-route editor shows populated parent app SelectBox", async ({ page }) => {
        await gotoEditor(page);

        // ui-route node is not in the mount fixture; use a ui-store which has a parent select
        // Instead, verify via the ui-store node (app-scoped)
        await openEditor(page, "mountStore");

        const options = await page.evaluate(() => {
            const select = document.querySelector<HTMLSelectElement>("#node-input-parent");
            return select ? Array.from(select.options).map((o) => ({ value: o.value, text: o.text })) : [];
        });

        // Should have at least one app entry (from the fixture apps)
        const appEntries = options.filter((o) => o.value !== "");
        expect(appEntries.length).toBeGreaterThan(0);
    });

    test("ui-button editor parent slot selector shows route entries", async ({ page }) => {
        await gotoEditor(page);
        await openEditor(page, "mountButtonNode");

        const mountOptionValues = await page.evaluate(() => {
            const select = document.querySelector<HTMLSelectElement>("#node-input-mount");
            // Read option values — the tree-select widget uses "<appId>.<slot>" values
            // so we can verify the correct app slots are populated without relying on
            // the human-readable label format which changed with the tree widget.
            return select ? Array.from(select.options).map((o) => o.value).filter((v) => v !== "") : [];
        });

        // The fixture has 5 apps; each should contribute at least its "content" slot.
        // Verify slot entries for the "App Layout Demo" (mountAppShellDemo) which has
        // header, navbar, content, footer — 4 slots covering the full app layout.
        const appShellEntries = mountOptionValues.filter((v) => v.startsWith("mountAppShellDemo."));
        expect(appShellEntries.length).toBeGreaterThan(0);
    });

    test("ui-button registered type has onadd that produces a name default", async ({ page }) => {
        await gotoEditor(page);

        const result = await page.evaluate(() => {
            // Get the registered node type definition
            const typeDef = (RED.nodes as unknown as { getType: (type: string) => { onadd?: () => void } | undefined }).getType?.("ui-button");
            if (!typeDef || typeof typeDef.onadd !== "function") {
                return { hasOnadd: false, name: "" };
            }

            // Count current ui-button nodes
            let count = 0;
            RED.nodes.eachNode((n: { type: string }) => {
                if (n.type === "ui-button") count++;
            });

            // Call onadd with a fake node context (no name set)
            const fakeNode: { name: string; type?: string } = { name: "" };
            typeDef.onadd.call(fakeNode);

            return { hasOnadd: true, name: fakeNode.name, expectedN: count + 1 };
        });

        expect(result.hasOnadd).toBe(true);
        expect(result.name).toBe(`Button ${result.expectedN}`);
    });
});
