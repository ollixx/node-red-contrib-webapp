import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P73 — E2E: ui-slider showValue is rendered as sl-range label-value attribute.
 */

test.describe("ui-slider P73 — showValue rendered", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-range without tooltip=none when showValue=true (tooltip visible)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl73App", root: "sl73App" })
            .node("ui-slider", {
                id: "sl73Node",
                label: "Volume",
                min: 0,
                max: 100,
                step: 1,
                showValue: true,
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl73App");
        await webapp.navigate("/");

        const sl = page.locator("sl-range");
        await expect(sl).toBeVisible();
        // showValue=true → no tooltip="none" suppression (Shoelace default tooltip is visible)
        const tooltipAttr = await sl.getAttribute("tooltip");
        expect(tooltipAttr).not.toBe("none");
    });

    test("renders sl-range with tooltip=none when showValue is not set (default hidden)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl73App2", root: "sl73App2" })
            .node("ui-slider", { id: "sl73Node2", min: 0, max: 100, step: 1 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl73App2");
        await webapp.navigate("/");

        const sl = page.locator("sl-range");
        await expect(sl).toBeVisible();
        await expect(sl).toHaveAttribute("tooltip", "none");
    });
});
