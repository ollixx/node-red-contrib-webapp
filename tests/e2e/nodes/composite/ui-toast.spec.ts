import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-toast (composite node).
 *
 * Covers:
 *   - Not visible by default (no sl-alert in the DOM on page load).
 *   - Input port message → toast appears via SSE (sl-alert appended to body).
 *   - Toast carries severity from node definition.
 *   - Toast message comes from msg.payload.
 */

test.describe("ui-toast (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("not visible by default — no toast in DOM on page load", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp1", root: "toastApp1" })
            // ui-toast has no mount — it does not render into the layout.
            .node("ui-toast", {
                id: "toastNode1",
                severity: "info",
                duration: 3000
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp1");
        await webapp.navigate("/");

        // No sl-alert.webapp-toast should be present before a message is injected.
        await expect(page.locator("sl-alert.webapp-toast")).toHaveCount(0);
    });

    test("input port message → sl-alert.webapp-toast appears in DOM via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp2", root: "toastApp2" })
            .node("ui-toast", {
                id: "toastNode2",
                severity: "success",
                duration: 5000
            })
            .withInjectNode("toastInj2", "toastNode2", "Toast message appeared!")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp2");
        await webapp.navigate("/");

        // Inject a message to trigger the toast.
        await injectMessage(request, "toastInj2");

        // The toast should appear as sl-alert appended to the body.
        const toast = page.locator("sl-alert.webapp-toast");
        await expect(toast).toBeVisible({ timeout: 5000 });
        await expect(toast).toContainText("Toast message appeared!");
    });

    test("toast carries the severity from the node definition", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp3", root: "toastApp3" })
            .node("ui-toast", {
                id: "toastNode3",
                severity: "warning",
                duration: 5000
            })
            .withInjectNode("toastInj3", "toastNode3", "Warning!")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp3");
        await webapp.navigate("/");

        await injectMessage(request, "toastInj3");

        const toast = page.locator("sl-alert.webapp-toast");
        await expect(toast).toBeVisible({ timeout: 5000 });
        await expect(toast).toHaveAttribute("variant", "warning");
    });
});
