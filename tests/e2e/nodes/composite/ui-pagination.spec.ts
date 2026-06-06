import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-pagination (composite node).
 *
 * Covers:
 *   - prev/next buttons are visible.
 *   - prev click → POST /event { event:"change", params:{ page: n-1 } }.
 *   - next click → POST /event { event:"change", params:{ page: n+1 } }.
 *   - Disabled state on first page (prev disabled) and last page (next disabled).
 */

test.describe("ui-pagination (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("prev and next buttons render inside .webapp-pagination", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pgApp1", root: "pgApp1" })
            .node("ui-pagination", {
                id: "pgNode1",
                page: { kind: "literal", value: 2 },
                totalPages: { kind: "literal", value: 5 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pgApp1");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-pagination")).toBeVisible();
        // There should be two sl-button elements (prev and next).
        await expect(page.locator(".webapp-pagination sl-button")).toHaveCount(2);
    });

    test("current page label shows page / totalPages", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pgApp2", root: "pgApp2" })
            .node("ui-pagination", {
                id: "pgNode2",
                page: { kind: "literal", value: 3 },
                totalPages: { kind: "literal", value: 10 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pgApp2");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-pagination-page")).toContainText("3 / 10");
    });

    test("next button click → POST /event with event='change' and params.page = n+1", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pgApp3", root: "pgApp3" })
            .node("ui-pagination", {
                id: "pgNode3",
                page: { kind: "literal", value: 2 },
                totalPages: { kind: "literal", value: 5 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pgApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        // Next button is the second sl-button (prev, next)
        await page.locator(".webapp-pagination sl-button").nth(1).click();

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).page).toBe(3);
    });

    test("prev button click → POST /event with event='change' and params.page = n-1", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pgApp4", root: "pgApp4" })
            .node("ui-pagination", {
                id: "pgNode4",
                page: { kind: "literal", value: 4 },
                totalPages: { kind: "literal", value: 10 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pgApp4");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        // Prev button is the first sl-button
        await page.locator(".webapp-pagination sl-button").nth(0).click();

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).page).toBe(3);
    });

    test("prev button disabled on first page", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pgApp5", root: "pgApp5" })
            .node("ui-pagination", {
                id: "pgNode5",
                page: { kind: "literal", value: 1 },
                totalPages: { kind: "literal", value: 5 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pgApp5");
        await webapp.navigate("/");

        // Prev button (first sl-button) should be disabled on page 1.
        await expect(page.locator(".webapp-pagination sl-button").nth(0)).toHaveAttribute("disabled", "");
    });

    test("next button disabled on last page", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pgApp6", root: "pgApp6" })
            .node("ui-pagination", {
                id: "pgNode6",
                page: { kind: "literal", value: 5 },
                totalPages: { kind: "literal", value: 5 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pgApp6");
        await webapp.navigate("/");

        // Next button (second sl-button) should be disabled on last page.
        await expect(page.locator(".webapp-pagination sl-button").nth(1)).toHaveAttribute("disabled", "");
    });
});
