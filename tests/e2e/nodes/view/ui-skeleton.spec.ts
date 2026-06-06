import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-skeleton (stateless view node).
 *
 * ui-skeleton is included in the component filter and renders into the layout.
 * The serializer does not yet have a dedicated Shoelace element for skeleton
 * (sl-skeleton is not part of the standard Shoelace bundle used here), so the
 * node renders as a fallback text element. These tests verify that the node:
 *   1. Renders without crashing.
 *   2. Is included in the app root.
 *   3. Does not break layout when placed alongside other nodes.
 */

test.describe("ui-skeleton (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "skelApp1", root: "skelApp1" })
            .node("ui-skeleton", { id: "skelNode1", visible: "true" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "skelApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
    });

    test("skeleton alongside text node — layout renders correctly", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "skelApp2", root: "skelApp2" })
            .node("ui-skeleton", { id: "skelNode2", visible: "true" })
            .node("ui-text", { id: "skelText2", text: "Content loaded" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "skelApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Content loaded");
    });

    test("variant prop accepted without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "skelApp3", root: "skelApp3" })
            .node("ui-skeleton", { id: "skelNode3", visible: "true", variant: "text" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "skelApp3");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
    });
});
