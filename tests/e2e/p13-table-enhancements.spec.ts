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

test.describe("P13: ui-table enhancements — editor", () => {
    let baselineFlow: FlowNode[];

    test.beforeAll(async () => {
        baselineFlow = await loadFlowFixture("examples/customers-crud/flow.json");
    });

    test.afterEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    test("ui-table registered type has events and footer defaults", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    defaults?: Record<string, { value: unknown }>;
                    outputLabels?: unknown;
                } | undefined
            }).getType?.("ui-table");

            if (!typeDef) {
                return { found: false, hasEventsDefault: false, hasFooterDefault: false, hasOutputLabels: false };
            }

            return {
                found: true,
                hasEventsDefault: "events" in (typeDef.defaults || {}),
                hasFooterDefault: "footer" in (typeDef.defaults || {}),
                hasOutputLabels: typeof typeDef.outputLabels === "function"
            };
        });

        expect(result.found).toBe(true);
        expect(result.hasEventsDefault).toBe(true);
        expect(result.hasFooterDefault).toBe(true);
        expect(result.hasOutputLabels).toBe(true);
    });

    test("ui-table outputLabels returns row event names for enabled events", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    outputLabels?: (index: number) => string;
                } | undefined
            }).getType?.("ui-table");

            if (!typeDef || typeof typeDef.outputLabels !== "function") {
                return { found: false, label0: "", label1: "" };
            }

            const fakeNode = { events: JSON.stringify(["rowSelect", "rowAction"]), outputs: 2 };
            return {
                found: true,
                label0: typeDef.outputLabels.call(fakeNode, 0),
                label1: typeDef.outputLabels.call(fakeNode, 1)
            };
        });

        expect(result.found).toBe(true);
        expect(result.label0).toBe("rowSelect");
        expect(result.label1).toBe("rowAction");
    });

    test("ui-table editor HTML contains events-container and footer checkbox", async ({ page, request }) => {
        const mountFlow = await loadFlowFixture("tests/e2e/fixtures/editor-mount-options.flow.json");
        await deployFlow(request, mountFlow);

        await page.goto("/");
        await page.waitForLoadState("networkidle");

        await page.waitForFunction(() => {
            const nodeApi = (window as typeof window & { RED?: { nodes?: { node: (nodeId: string) => unknown } } }).RED?.nodes;
            return typeof nodeApi?.node === "function";
        });

        // Verify the template script content contains expected markup
        const result = await page.evaluate(() => {
            const template = document.querySelector('[data-template-name="ui-table"]');
            if (!template) return { found: false, hasEventsContainer: false, hasFooter: false, hasEventsHidden: false };
            const html = template.innerHTML || template.textContent || "";

            return {
                found: true,
                hasEventsContainer: html.includes("node-input-events-container"),
                hasFooter: html.includes("node-input-footer"),
                hasEventsHidden: html.includes("node-input-events")
            };
        });

        expect(result.found).toBe(true);
        expect(result.hasEventsContainer).toBe(true);
        expect(result.hasFooter).toBe(true);
        expect(result.hasEventsHidden).toBe(true);
    });
});
