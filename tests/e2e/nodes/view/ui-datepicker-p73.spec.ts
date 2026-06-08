import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P73 — E2E: ui-datepicker mode correctly maps to HTML input type attribute.
 *
 * mode=date     → type="date"
 * mode=datetime → type="datetime-local"
 * mode=time     → type="time"
 * (no mode)     → type="date" (default)
 */

test.describe("ui-datepicker P73 — mode maps to correct type", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("default (no mode) renders sl-input[type=date]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dp73App1", root: "dp73App1" })
            .node("ui-datepicker", { id: "dp73Node1", label: "Date" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dp73App1");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[type=date]")).toBeVisible();
    });

    test("mode='date' renders sl-input[type=date]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dp73App2", root: "dp73App2" })
            .node("ui-datepicker", { id: "dp73Node2", label: "Date", mode: "date" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dp73App2");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[type=date]")).toBeVisible();
    });

    test("mode='datetime' renders sl-input[type=datetime-local]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dp73App3", root: "dp73App3" })
            .node("ui-datepicker", { id: "dp73Node3", label: "Datetime", mode: "datetime" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dp73App3");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[type=datetime-local]")).toBeVisible();
        await expect(page.locator("sl-input[type=date]")).not.toBeVisible();
    });

    test("mode='time' renders sl-input[type=time]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dp73App4", root: "dp73App4" })
            .node("ui-datepicker", { id: "dp73Node4", label: "Time", mode: "time" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dp73App4");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[type=time]")).toBeVisible();
        await expect(page.locator("sl-input[type=date]")).not.toBeVisible();
    });
});
