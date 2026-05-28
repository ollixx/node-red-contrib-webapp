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

async function readMountOptions(page: Parameters<typeof test>[0]["page"], nodeId: string) {
    await page.evaluate((id) => {
        const node = RED.nodes.node(id);
        RED.editor.edit(node);
    }, nodeId);
    await page.waitForTimeout(300);

    return page.evaluate(() => {
        const select = document.querySelector<HTMLSelectElement>("#node-input-mount");
        return select ? Array.from(select.options).map((option) => option.text) : [];
    });
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
        const expectedOptions = [
            "App mountAppShellDemo -> content",
            "App mountAppShellDemo -> footer",
            "App mountAppShellDemo -> header",
            "App mountAppShellDemo -> navbar",
            "App mountHorizontalApp -> content",
            "App mountVerticalApp -> content"
        ];

        await page.goto("/");
        await page.waitForLoadState("networkidle");

        for (const nodeId of ["mountTextNode", "mountButtonNode", "mountInputNode", "mountContainerNode"]) {
            const options = await readMountOptions(page, nodeId);
            expect(options).toEqual(expect.arrayContaining(expectedOptions));
        }
    });
});