import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-list (composite node).
 *
 * Covers:
 *   - Items array renders <ul> with <li> elements containing item labels.
 *   - itemClick event: click on a list item → POST /event { event:"itemClick", params:{ value } }.
 */

test.describe("ui-list (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("items render as <ul class='webapp-list'> with <li> elements", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "lstApp1", root: "lstApp1" })
            .node("ui-list", {
                id: "lstNode1",
                items: JSON.stringify([
                    { id: "item-a", label: "Apple" },
                    { id: "item-b", label: "Banana" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "lstApp1");
        await webapp.navigate("/");

        await expect(page.locator("ul.webapp-list")).toBeVisible();
        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText("Apple");
        await expect(items.nth(1)).toContainText("Banana");
    });

    test("itemClick event: click → POST /event with event='itemClick' and params.value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "lstApp2", root: "lstApp2" })
            .node("ui-list", {
                id: "lstNode2",
                items: JSON.stringify([
                    { id: "fruit-1", label: "Cherry" },
                    { id: "fruit-2", label: "Date" }
                ]),
                events: JSON.stringify(["itemClick"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "lstApp2");
        await webapp.navigate("/");

        // Verify the rendered data-webapp-item attribute before clicking.
        const listHtml = await page.locator("ul.webapp-list").innerHTML();
        // The first item should have data-webapp-item="fruit-1" (the id, not the label).
        // If it contains "fruit-1", the id is correctly used; otherwise debug via listHtml.
        expect(listHtml).toContain("fruit-1");

        const eventPromise = webapp.interceptNextEvent();

        // Click the first item's link
        await page.locator("ul.webapp-list li.webapp-list-item a.webapp-link").first().click();

        const body = await eventPromise;
        expect(body.event).toBe("itemClick");
        // P171: the dispatched shape is { rowId, row } — rowId = the item id
        // ("fruit-1", not the label), row = the whole element incl. value.
        const params = body.params as Record<string, unknown>;
        expect(params.rowId).toBe("fruit-1");
        expect((params.row as Record<string, unknown>).label).toBe("Cherry");
    });

    test("empty items renders <ul> without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "lstApp3", root: "lstApp3" })
            .node("ui-list", { id: "lstNode3", items: JSON.stringify([]) })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "lstApp3");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
    });
});
