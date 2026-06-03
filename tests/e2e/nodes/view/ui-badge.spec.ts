import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-badge (stateless view node).
 *
 * Covers:
 *   1. Renders the correct Shoelace element (sl-badge).
 *   2. Value renders inside the badge.
 *   3. severity "success" → sl-badge variant="success".
 *   4. Empty/default state renders without crashing.
 */

test.describe("ui-badge (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-badge element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp1", root: "badgeApp1" })
            .route({ id: "badgeRoute1", path: "/" })
            .node("ui-badge", { id: "badgeNode1", value: { kind: "literal", value: "42" } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "badgeApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-badge")).toBeVisible();
    });

    test("value renders inside sl-badge", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp2", root: "badgeApp2" })
            .route({ id: "badgeRoute2", path: "/" })
            .node("ui-badge", { id: "badgeNode2", value: { kind: "literal", value: "99" } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "badgeApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-badge")).toContainText("99");
    });

    test("severity 'success' — sl-badge variant=success", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp3", root: "badgeApp3" })
            .route({ id: "badgeRoute3", path: "/" })
            .node("ui-badge", { id: "badgeNode3", value: { kind: "literal", value: "OK" }, severity: "success" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "badgeApp3");
        await webapp.navigate("/");
        // Verify via DOM property — Shoelace may not reflect the attribute after upgrade.
        const variant = await page.locator("sl-badge").evaluate((el) => el.getAttribute("variant") ?? el.variant ?? "");
        expect(variant).toBe("success");
    });

    test("default/empty state renders without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp4", root: "badgeApp4" })
            .route({ id: "badgeRoute4", path: "/" })
            .node("ui-badge", { id: "badgeNode4", value: { kind: "literal", value: "" } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "badgeApp4");
        await webapp.navigate("/");
        // Must render without error — the root is visible and sl-badge is present.
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-badge")).toBeVisible();
    });
});
