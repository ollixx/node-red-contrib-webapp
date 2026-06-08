import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-accordion (composite node).
 *
 * Covers:
 *   - Items array renders sl-details elements with correct summary text.
 *   - Default state renders without crashing.
 */

test.describe("ui-accordion (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("items render as sl-details elements with summary labels", async ({ page, request }) => {
        // Pass items as a JSON array string — parseJsonList handles it correctly.
        const items = JSON.stringify([
            { id: "section-a", label: "Section A" },
            { id: "section-b", label: "Section B" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "accApp1", root: "accApp1" })
            .node("ui-accordion", { id: "accNode1", sections: items })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "accApp1");
        await webapp.navigate("/");

        // Use :scope > sl-details to match only direct light-DOM children.
        const details = page.locator(".webapp-accordion > sl-details");
        await expect(details).toHaveCount(2);
        await expect(details.nth(0)).toHaveAttribute("summary", "Section A");
        await expect(details.nth(1)).toHaveAttribute("summary", "Section B");
    });

    test("single-item accordion renders without crashing", async ({ page, request }) => {
        const items = JSON.stringify([{ id: "faq-1", label: "What is this?" }]);

        const flow = new FlowBuilder()
            .app({ id: "accApp2", root: "accApp2" })
            .node("ui-accordion", { id: "accNode2", sections: items })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "accApp2");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-accordion")).toBeVisible();
        await expect(page.locator(".webapp-accordion > sl-details")).toHaveCount(1);
    });

    test("empty items renders accordion container without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "accApp3", root: "accApp3" })
            .node("ui-accordion", { id: "accNode3", sections: "" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "accApp3");
        await webapp.navigate("/");

        await expect(webapp.root()).toBeVisible();
    });
});
