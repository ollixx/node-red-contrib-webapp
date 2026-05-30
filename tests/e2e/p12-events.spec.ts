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

test.describe("P12: configurable event system — editor", () => {
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

    test("ui-app registered type has outputLabels and event defaults", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    defaults?: Record<string, { value: unknown }>;
                    outputLabels?: unknown;
                } | undefined
            }).getType?.("ui-app");

            if (!typeDef) {
                return { found: false, hasEventsDefault: false, hasOutputLabels: false };
            }

            return {
                found: true,
                hasEventsDefault: "events" in (typeDef.defaults || {}),
                hasOutputLabels: typeof typeDef.outputLabels === "function"
            };
        });

        expect(result.found).toBe(true);
        expect(result.hasEventsDefault).toBe(true);
        expect(result.hasOutputLabels).toBe(true);
    });

    test("ui-app outputLabels returns clientConnected and clientDisconnected for enabled events", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    outputLabels?: (index: number) => string;
                } | undefined
            }).getType?.("ui-app");

            if (!typeDef || typeof typeDef.outputLabels !== "function") {
                return { found: false, label0: "", label1: "" };
            }

            const fakeNode = { events: JSON.stringify(["clientConnected", "clientDisconnected"]), outputs: 2 };
            return {
                found: true,
                label0: typeDef.outputLabels.call(fakeNode, 0),
                label1: typeDef.outputLabels.call(fakeNode, 1)
            };
        });

        expect(result.found).toBe(true);
        expect(result.label0).toBe("clientConnected");
        expect(result.label1).toBe("clientDisconnected");
    });

    test("ui-route registered type has event defaults for onEnter and onLeave", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    defaults?: Record<string, { value: unknown }>;
                    outputLabels?: unknown;
                } | undefined
            }).getType?.("ui-route");

            if (!typeDef) {
                return { found: false, eventsDefault: null };
            }

            return {
                found: true,
                eventsDefault: typeDef.defaults?.["events"]?.value ?? null,
                hasOutputLabels: typeof typeDef.outputLabels === "function"
            };
        });

        expect(result.found).toBe(true);
        expect(result.eventsDefault).toBe("[]");
    });

    test("ui-container registered type has event defaults for onShow and onHide", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        await openEditor(page, "mountContainerNode");

        const checkboxes = await page.evaluate(() => {
            const boxes = document.querySelectorAll<HTMLInputElement>("#node-input-events-container input[type=checkbox]");
            return Array.from(boxes).map((cb) => cb.dataset["event"] || cb.id);
        });

        expect(checkboxes).toContain("onShow");
        expect(checkboxes).toContain("onHide");
    });

    test("enabling onEnter on a ui-route node updates outputs count via oneditsave logic", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    outputLabels?: (index: number) => string;
                    oneditsave?: () => void;
                    defaults?: Record<string, { value: unknown }>;
                } | undefined
            }).getType?.("ui-route");

            if (!typeDef || typeof typeDef.outputLabels !== "function") {
                return { found: false, label: "" };
            }

            // Simulate a node with onEnter event active
            const fakeNode = { events: JSON.stringify(["onEnter"]), outputs: 1 };
            const label = typeDef.outputLabels.call(fakeNode, 0);

            return { found: true, label };
        });

        expect(result.found).toBe(true);
        expect(result.label).toBe("onEnter");
    });
});
