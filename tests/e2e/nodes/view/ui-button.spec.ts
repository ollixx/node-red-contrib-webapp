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
 *   - variant prop → sl-button[variant] attribute (P50 round-trip).
 */

test.describe("ui-button render (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("label renders as button text inside sl-button", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp1", root: "btnApp1" })
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
            .node("ui-button", { id: "btnNode4" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "btnApp4");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-button")).toBeVisible();
    });

    /**
     * P50 round-trip: the `variant` prop stored by the editor SelectBox must
     * reach the Shoelace adapter and produce sl-button[variant="<value>"].
     */
    test("variant='danger' → sl-button[variant=danger] rendered", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp5", root: "btnApp5" })
            .node("ui-button", { id: "btnNode5", label: "Delete", variant: "danger" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "btnApp5");
        await webapp.navigate("/");
        await expect(page.locator('sl-button[variant="danger"]')).toBeVisible();
    });
});
