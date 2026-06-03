import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E render-only specs for ui-button (stateless view node).
 *
 * Click / event tests live in P44. This spec covers rendering only:
 *   - label renders as button text inside sl-button.
 *   - sl-button element is present in the rendered DOM.
 *   - disabled binding (literal) → sl-button[disabled] rendered.
 *
 * Note: ui-button does not currently plumb the `variant` node prop through the
 * config chain (not present in the spec or mapConfig). Variant tests are
 * therefore omitted here.
 */

test.describe("ui-button render (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("label renders as button text inside sl-button", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp1", root: "btnApp1" })
            .route({ id: "btnRoute1", path: "/" })
            .node("ui-button", { id: "btnNode1", label: "Click me" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "btnApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-button")).toContainText("Click me");
    });

    test("sl-button element is present in rendered DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp2", root: "btnApp2" })
            .route({ id: "btnRoute2", path: "/" })
            .node("ui-button", { id: "btnNode2", label: "My Button" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "btnApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-button")).toBeVisible();
    });

    test("disabled binding (literal true) — sl-button[disabled] rendered", async ({ page, request }) => {
        // The disabled field must be a binding object for it to survive schema
        // validation and reach the serializer. A literal boolean binding of true
        // produces sl-button[disabled].
        const flow = new FlowBuilder()
            .app({ id: "btnApp3", root: "btnApp3" })
            .route({ id: "btnRoute3", path: "/" })
            .node("ui-button", {
                id: "btnNode3",
                label: "Locked",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "btnApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-button[disabled]")).toBeVisible();
    });

    test("default state renders without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp4", root: "btnApp4" })
            .route({ id: "btnRoute4", path: "/" })
            .node("ui-button", { id: "btnNode4" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "btnApp4");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-button")).toBeVisible();
    });
});
