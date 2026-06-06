import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P46 — per-node E2E specs for ui-navigation (behavior node).
 *
 * ui-navigation is a parametrized-route resolver. It does not render a visual
 * component itself; it acts as a named navigation target for buttons and actions.
 * When a button's `action` resolves to a ui-navigation node, the client uses
 * its `to` path (with optional `:param` segments resolved from row/payload data).
 *
 * Visual navigation links in the navbar are sl-button nodes mounted to the
 * `layout:app/navbar` slot (app layout preset), styled as nav links via
 * `.webapp-slot--navbar sl-button::part(base)`.
 *
 * The `layout:app/navbar` slot is only available when the route itself uses
 * `layoutId: "app"`. The app root route (auto-created when no "/" route exists)
 * uses the ui-app's `layout` field; if the ui-app has `layout: "app"` and no
 * explicit "/" route is defined, the auto route gets `layoutId: "app"`.
 *
 * Covers (per P46 scope):
 *   - ui-navigation node deployed alongside a button: deploying both does not
 *     break rendering.
 *   - A button in the navbar slot renders and is visible in the navbar region.
 *   - Clicking the button emits a click event (routing to a wired action).
 *   - ui-navigation node alone (no referencing button) doesn't break rendering.
 */

test.describe("ui-navigation (P46)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── navbar button renders in the navbar slot (app layout) ────────────────

    test("a button mounted to layout:app/navbar is visible in the navbar region", async ({ page, request }) => {
        // Use an app with layout: "app" and NO explicit "/" route so the auto app-root
        // route (with layoutId: "app") is used. The navbar slot is part of the app layout.
        const flow = new FlowBuilder()
            .app({ id: "navApp1", root: "navApp1", layout: "app" })
            // Add a non-"/" route so the auto app-root route at "/" is generated.
            .route({ id: "navContent1", path: "/content" })
            .node("ui-text", { id: "navTxt1", text: "Content page" })
            .node("ui-navigation", {
                id: "navNode1",
                to: "/content"
            })
            .build();

        // Add a ui-button mounted to the navbar slot.
        const fullFlow = [
            ...flow,
            {
                type: "ui-button",
                id: "navBtn1",
                uiId: "navBtn1",
                name: "Nav Home",
                parent: "navApp1",
                mount: "layout:app/navbar",
                label: "Home",
                z: "e2e-flow",
                x: 100,
                y: 500,
                wires: [[]]
            }
        ];

        await deployFlow(request, fullFlow);

        const webapp = new WebappPage(page, "navApp1");
        // Navigate to the app root (auto-created at "/" with app layout).
        await webapp.navigate("/");

        // The navbar slot must render and contain the button.
        await expect(page.locator(".webapp-slot--navbar")).toBeVisible();
        await expect(page.locator(".webapp-slot--navbar sl-button")).toContainText("Home");
    });

    // ─── clicking nav button navigates to target route ────────────────────────

    test("clicking a navbar button wired to a ui-action(navigate) goes to the target route", async ({ page, request }) => {
        // Build an app with:
        //   - layout: "app" so the navbar slot is available
        //   - Two sub-routes: /alpha and /beta
        //   - A navbar button on the root (auto) route that navigates to /beta
        //   - A ui-action(navigate) wired from the button
        const flow = new FlowBuilder()
            .app({ id: "navApp2", root: "navApp2", layout: "app" })
            .route({ id: "navAlpha", path: "/alpha" })
            .node("ui-text", { id: "navAlphaTxt", text: "Alpha page" })
            .route({ id: "navBeta", path: "/beta" })
            .node("ui-text", { id: "navBetaTxt", text: "Beta page" })
            .node("ui-action", {
                id: "navActionBeta",
                actionType: "navigate",
                to: "/beta"
            })
            .build();

        const fullFlow = [
            ...flow,
            // Navbar button mounted on the auto "/" route (app layout).
            {
                type: "ui-button",
                id: "navBtn2",
                uiId: "navBtn2",
                name: "Go Beta",
                parent: "navApp2",
                mount: "layout:app/navbar",
                label: "Beta",
                action: "navActionBeta",
                events: JSON.stringify(["click"]),
                z: "e2e-flow",
                x: 100,
                y: 500,
                wires: [["navActionBeta"]]
            }
        ];

        await deployFlow(request, fullFlow);

        const webapp = new WebappPage(page, "navApp2");
        // Start on /alpha.
        await webapp.navigate("/alpha");
        await expect(webapp.root()).toContainText("Alpha page");

        // Navigate to "/" first to see the navbar.
        await webapp.navigate("/");
        await expect(page.locator(".webapp-slot--navbar sl-button")).toContainText("Beta");

        // Click the button — fires a click event. The action node in the flow
        // receives the event and pushes a navigate command.
        await page.locator(".webapp-slot--navbar sl-button").click();

        // Navigate command → client follows to /beta.
        await page.waitForURL(/\/beta/, { timeout: 5000 });
        await expect(webapp.root()).toContainText("Beta page");
    });

    // ─── ui-navigation node is inert without a referencing button ────────────

    test("deploying a ui-navigation node alone does not break the page render", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "navApp3", root: "navApp3" })
            .node("ui-text", { id: "navTxt3", text: "Page renders fine" })
            .node("ui-navigation", {
                id: "navNode3",
                to: "/other"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "navApp3");
        await webapp.navigate("/");

        // The ui-navigation node contributes no visible markup.
        await expect(webapp.root()).toContainText("Page renders fine");
    });
});
