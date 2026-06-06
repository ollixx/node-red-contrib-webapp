import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-alert (stateless view node).
 *
 * Covers:
 *   1. Renders the correct Shoelace element (sl-alert).
 *   2. severity "warning" → sl-alert variant="warning".
 *   3. severity "error" → sl-alert variant="danger".
 *   4. message binding renders as alert content.
 *
 * The message field must be a binding object (e.g. { kind: "literal", value: "..." })
 * for it to survive Zod schema validation and reach the serializer.
 */

test.describe("ui-alert (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-alert element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alertApp1", root: "alertApp1" })
            .node("ui-alert", { id: "alertNode1", message: { kind: "literal", value: "Something happened" } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "alertApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert")).toBeVisible();
    });

    test("severity 'warning' — sl-alert variant=warning", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alertApp2", root: "alertApp2" })
            .node("ui-alert", {
                id: "alertNode2",
                message: { kind: "literal", value: "Watch out" },
                severity: "warning"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "alertApp2");
        await webapp.navigate("/");
        const variant = await page.locator("sl-alert").evaluate((el) => el.getAttribute("variant") ?? el.variant ?? "");
        expect(variant).toBe("warning");
    });

    test("severity 'error' — sl-alert variant=danger", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alertApp3", root: "alertApp3" })
            .node("ui-alert", {
                id: "alertNode3",
                message: { kind: "literal", value: "Error occurred" },
                severity: "error"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "alertApp3");
        await webapp.navigate("/");
        const variant = await page.locator("sl-alert").evaluate((el) => el.getAttribute("variant") ?? el.variant ?? "");
        expect(variant).toBe("danger");
    });

    test("message binding renders as alert content", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alertApp4", root: "alertApp4" })
            .node("ui-alert", {
                id: "alertNode4",
                message: { kind: "literal", value: "Alert message text" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "alertApp4");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert")).toContainText("Alert message text");
    });
});
