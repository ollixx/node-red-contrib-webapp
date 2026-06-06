import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — ui-button click → POST /event spec (deferred from P43).
 *
 * The rendering tests for ui-button live in ui-button.spec.ts (P43). This file
 * adds the event/interaction tests that were intentionally deferred:
 *   - Click on sl-button → POST /event { event:"click" }.
 */

test.describe("ui-button events (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("click on sl-button → POST /event with event='click'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnEvtApp1", root: "btnEvtApp1" })
            .node("ui-button", { id: "btnEvtNode1", label: "Submit" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "btnEvtApp1");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        // Click the sl-button directly — Playwright dispatches the click on the host element.
        await page.locator("sl-button").click();

        const body = await eventPromise;
        expect(body.event).toBe("click");
        expect(body.sourceId).toBe("btnEvtNode1");
    });
});
