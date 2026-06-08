import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P73 — E2E: ui-switch labelOn/labelOff are rendered as sl-switch attributes.
 */

test.describe("ui-switch P73 — labelOn/labelOff rendered", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-switch with label-on and label-off attributes", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw73App", root: "sw73App" })
            .node("ui-switch", {
                id: "sw73Node",
                label: "Toggle",
                labelOn: "On",
                labelOff: "Off",
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw73App");
        await webapp.navigate("/");

        const sw = page.locator("sl-switch");
        await expect(sw).toBeVisible();
        await expect(sw).toHaveAttribute("label-on", "On");
        await expect(sw).toHaveAttribute("label-off", "Off");
    });

    test("renders sl-switch without label-on/label-off when not configured", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sw73App2", root: "sw73App2" })
            .node("ui-switch", { id: "sw73Node2", label: "Simple" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sw73App2");
        await webapp.navigate("/");

        const sw = page.locator("sl-switch");
        await expect(sw).toBeVisible();
        await expect(sw).not.toHaveAttribute("label-on");
        await expect(sw).not.toHaveAttribute("label-off");
    });
});
