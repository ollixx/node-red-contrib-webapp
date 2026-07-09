import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * Owner (2026-07-09): an actionable ui-list only receives clicks on the inner
 * text — the whole row/panel should be clickable. Root cause: the row padding
 * lived on the <li>, so its padding ring was a dead zone (the click hook sits on
 * the inner <a data-webapp-source>). The clickable anchor must fill the ENTIRE
 * row. Proven by MEASUREMENT (bounding boxes), not markup: the <a.webapp-link>
 * box must equal its <li.webapp-list-item> box.
 */

test.describe("ui-list actionable — whole row is the click target", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the interactive anchor fills the entire list row (no dead padding ring)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "clkApp", root: "clkApp" })
            .node("ui-list", {
                id: "clkList",
                displayType: "actionable",
                items: JSON.stringify([
                    { id: "a", label: "Alpha", value: 1 },
                    { id: "b", label: "Bravo", value: 2 }
                ]),
                events: JSON.stringify(["itemClick"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "clkApp");
        await webapp.navigate("/");

        const li = page.locator("li.webapp-list-item").first();
        const anchor = li.locator("> a.webapp-link");
        await expect(anchor).toBeVisible();

        const liBox = await li.boundingBox();
        const aBox = await anchor.boundingBox();
        expect(liBox, "li bounding box").not.toBeNull();
        expect(aBox, "anchor bounding box").not.toBeNull();

        // The anchor must cover the full row — same top-left and same size,
        // within a 1px rounding tolerance. Pre-fix the li padding (10px 14px)
        // shrinks the anchor by 28px wide / 20px tall → this fails.
        expect(Math.abs(aBox!.x - liBox!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(aBox!.y - liBox!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(aBox!.width - liBox!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(aBox!.height - liBox!.height)).toBeLessThanOrEqual(1);
    });
});
