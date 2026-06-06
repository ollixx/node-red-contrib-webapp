import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P42 — per-node E2E specs for ui-route (structure node).
 *
 * Covers the properties documented in the P42 scope:
 *   - App root "/" (the implicit ui-app route) → renders at /webapp/:appId/.
 *   - route at "/customers" → renders at /webapp/:appId/customers.
 *   - app root + one sub-route: navigating to each shows its content.
 *   - layoutId "grid" vs "stack" → wrapper class differs in HTML.
 *   - title field → appears in the page <title> element.
 *
 * P48: a ui-route never uses path "/". The app is the implicit root route;
 * home content mounts directly to the ui-app slots (appId.content).
 */

test.describe("ui-route (P42)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("app root '/' (no ui-route) — renders home content at /webapp/:appId/", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeApp1", root: "routeApp1", name: "Route App", layout: "vertical" })
            .node("ui-text", { id: "routeHomeText", text: "Home content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp1");
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home content");
    });

    test("route at '/customers' — renders at /webapp/:appId/customers", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeApp2", root: "routeApp2", name: "Route App 2", layout: "vertical" })
            .route({ id: "routeCustomers2", path: "/customers" })
            .node("ui-text", { id: "routeCustomersText2", text: "Customers content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp2");
        await webapp.navigate("/customers");
        await expect(webapp.root()).toContainText("Customers content");
    });

    test("two routes — navigating to each shows its content", async ({ page, request }) => {
        // Build a flow with two routes, each containing a distinct text node.
        const flow = new FlowBuilder()
            .app({ id: "routeApp3", root: "routeApp3", name: "Multi-Route App", layout: "vertical" })
            .node("ui-text", { id: "routeHomeText3", text: "Home page" })
            .route({ id: "routeAbout3", path: "/about" })
            .node("ui-text", { id: "routeAboutText3", text: "About page" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp3");

        // First route
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home page");
        await expect(webapp.root()).not.toContainText("About page");

        // Second route
        await webapp.navigate("/about");
        await expect(webapp.root()).toContainText("About page");
        await expect(webapp.root()).not.toContainText("Home page");
    });

    test("layoutId 'grid' — webapp-layout--grid class in HTML", async ({ page, request }) => {
        // P48: layoutId is a ui-route property, so exercise it on a sub-path route.
        const flow = new FlowBuilder()
            .app({ id: "routeApp4", root: "routeApp4", name: "Grid App", layout: "vertical" })
            .route({ id: "routeGrid4", path: "/grid", layoutId: "grid" })
            .node("ui-text", { id: "routeGridText4", text: "Grid content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp4");
        await webapp.navigate("/grid");
        await expect(page.locator(".webapp-layout--grid")).toBeVisible();
    });

    test("layoutId 'vertical' (stack) — webapp-layout--vertical class in HTML", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeApp5", root: "routeApp5", name: "Stack App", layout: "vertical" })
            .route({ id: "routeStack5", path: "/stack", layoutId: "vertical" })
            .node("ui-text", { id: "routeStackText5", text: "Stack content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp5");
        await webapp.navigate("/stack");
        await expect(page.locator(".webapp-layout--vertical")).toBeVisible();
    });

    test("title field — appears in the page <title> element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeApp6", root: "routeApp6", name: "Titled App", layout: "vertical" })
            .route({ id: "routeTitle6", path: "/titled", title: "My Route Title" })
            .node("ui-text", { id: "routeTitleText6", text: "Titled content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp6");
        await webapp.navigate("/titled");
        await expect(page).toHaveTitle(/My Route Title/);
    });
});
