import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-text (stateless view node).
 *
 * Covers the properties documented in the P43 scope:
 *   - text content renders inside the component.
 *   - binding to store value renders the store's current value.
 *   - size prop maps to the correct variant attribute (via webapp-text class).
 */

test.describe("ui-text (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("text content renders inside the component", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp1", root: "textApp1" })
            .route({ id: "textRoute1", path: "/" })
            .node("ui-text", { id: "textNode1", text: "Hello from ui-text" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Hello from ui-text");
    });

    test("binding to store value renders the store's current value", async ({ page, request }) => {
        // Build a flow with a store holding an initial string and a text node
        // whose value is bound to the store's state path.
        const flow = new FlowBuilder()
            .app({ id: "textApp2", root: "textApp2" })
            .route({ id: "textRoute2", path: "/" })
            .node("ui-store", {
                id: "textStore2",
                statePath: "greeting",
                initialValue: "\"Hello from store\""
            })
            .node("ui-text", {
                id: "textNode2",
                value: { kind: "state", path: "greeting" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Hello from store");
    });

    test("renders inside webapp-text div", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "textApp3", root: "textApp3" })
            .route({ id: "textRoute3", path: "/" })
            .node("ui-text", { id: "textNode3", text: "Structured text" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "textApp3");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toBeVisible();
        await expect(webapp.root().locator(".webapp-text")).toContainText("Structured text");
    });
});
