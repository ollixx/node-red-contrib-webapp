import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-empty-state (stateless view node).
 *
 * ui-empty-state is included in the component filter. The serializer does not
 * have a dedicated rendering branch for it so it renders as a fallback text
 * element. These tests verify that the node:
 *   1. Renders without crashing.
 *   2. Is included in the app root.
 *   3. Does not break layout when placed alongside other nodes.
 */

test.describe("ui-empty-state (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "emptyApp1", root: "emptyApp1" })
            .node("ui-empty-state", {
                id: "emptyNode1",
                visible: "true",
                title: "No items",
                message: "Add one to get started."
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "emptyApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
    });

    test("empty-state alongside text node — layout renders correctly", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "emptyApp2", root: "emptyApp2" })
            .node("ui-empty-state", { id: "emptyNode2", visible: "true", title: "Empty" })
            .node("ui-text", { id: "emptyText2", text: "Other content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "emptyApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Other content");
    });

    test("icon and actionLabel props accepted without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "emptyApp3", root: "emptyApp3" })
            .node("ui-empty-state", {
                id: "emptyNode3",
                visible: "true",
                icon: "inbox",
                title: "Nothing here",
                message: "Check back later.",
                actionLabel: "Refresh"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "emptyApp3");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
    });
});
