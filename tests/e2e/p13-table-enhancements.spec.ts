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

test.describe("P13: ui-table enhancements — editor", () => {
    let baselineFlow: FlowNode[];

    test.beforeAll(async () => {
        baselineFlow = await loadFlowFixture("examples/customers-crud/flow.json");
    });

    test.afterEach(async ({ request }) => {
        await deployFlow(request, baselineFlow);
    });

    // P249: `footer` was removed as an inert field — assert it is GONE from the
    // registered defaults, and that `events` + outputLabels remain.
    test("ui-table registered type has events default and no footer default", async ({ page }) => {
        await gotoEditor(page);

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    defaults?: Record<string, { value: unknown }>;
                    outputLabels?: unknown;
                } | undefined
            }).getType?.("ui-table");

            if (!typeDef) {
                return { found: false, hasEventsDefault: false, hasFooterDefault: true, hasOutputLabels: false };
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
        expect(result.hasFooterDefault).toBe(false);
        expect(result.hasOutputLabels).toBe(true);
    });

    test("ui-table outputLabels returns the row event name for the enabled event", async ({ page }) => {
        await gotoEditor(page);

        const result = await page.evaluate(() => {
            const typeDef = (RED.nodes as unknown as {
                getType: (type: string) => {
                    outputLabels?: (index: number) => string;
                } | undefined
            }).getType?.("ui-table");

            if (!typeDef || typeof typeDef.outputLabels !== "function") {
                return { found: false, label0: "", label1: "" };
            }

            const fakeNode = { events: JSON.stringify(["rowSelect"]), outputs: 1 };
            return {
                found: true,
                label0: typeDef.outputLabels.call(fakeNode, 0),
                label1: typeDef.outputLabels.call(fakeNode, 1)
            };
        });

        expect(result.found).toBe(true);
        expect(result.label0).toBe("rowSelect");
        // P249: only rowSelect survives — the second port has no label.
        expect(result.label1).toBe("");
    });

    // P249: the footer checkbox was removed with the inert `footer` field — assert
    // the events container/hidden input remain and the footer input is GONE.
    test("ui-table editor HTML contains events-container and no footer checkbox", async ({ page, request }) => {
        const mountFlow = await loadFlowFixture("tests/e2e/fixtures/editor-mount-options.flow.json");
        await deployFlow(request, mountFlow);

        await gotoEditor(page);

        // Verify the template script content contains expected markup
        const result = await page.evaluate(() => {
            const template = document.querySelector('[data-template-name="ui-table"]');
            if (!template) return { found: false, hasEventsContainer: false, hasFooter: true, hasEventsHidden: false };
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
        expect(result.hasFooter).toBe(false);
        expect(result.hasEventsHidden).toBe(true);
    });
});
