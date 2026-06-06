import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-tabs (composite node).
 *
 * Covers:
 *   - Two tab children render as sl-tab / sl-panel pairs.
 *   - sl-tab-show event → POST /event { event:"change", params:{ value: tabId } }.
 */

test.describe("ui-tabs (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("tabs array renders as sl-tab-group with sl-tab elements", async ({ page, request }) => {
        // Pass tabs as a JSON array string — parseJsonList handles it correctly.
        const tabs = JSON.stringify([
            { id: "tab-a", label: "Tab A" },
            { id: "tab-b", label: "Tab B" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "tabApp1", root: "tabApp1" })
            .node("ui-tabs", { id: "tabNode1", tabs })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tabApp1");
        await webapp.navigate("/");

        await expect(page.locator("sl-tab-group")).toBeVisible();
        await expect(page.locator("sl-tab[panel='tab-a']")).toContainText("Tab A");
        await expect(page.locator("sl-tab[panel='tab-b']")).toContainText("Tab B");
    });

    test("sl-tab-panel elements are rendered for each tab", async ({ page, request }) => {
        const tabs = JSON.stringify([
            { id: "alpha", label: "Alpha" },
            { id: "beta", label: "Beta" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "tabApp2", root: "tabApp2" })
            .node("ui-tabs", { id: "tabNode2", tabs })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tabApp2");
        await webapp.navigate("/");

        await expect(page.locator("sl-tab-panel[name='alpha']")).toBeAttached();
        await expect(page.locator("sl-tab-panel[name='beta']")).toBeAttached();
    });

    test("sl-tab-show → POST /event with event='change' and params.value = tab id", async ({ page, request }) => {
        const tabs = JSON.stringify([
            { id: "t1", label: "Tab 1" },
            { id: "t2", label: "Tab 2" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "tabApp3", root: "tabApp3" })
            .node("ui-tabs", {
                id: "tabNode3",
                tabs,
                events: JSON.stringify(["change"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tabApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        // Dispatch sl-tab-show on the sl-tab-group element.
        await page.evaluate(() => {
            const tabGroup = document.querySelector("sl-tab-group") as HTMLElement;
            if (tabGroup) {
                tabGroup.dispatchEvent(new CustomEvent("sl-tab-show", {
                    detail: { name: "t2" },
                    bubbles: true,
                    composed: true
                }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("t2");
    });
});
