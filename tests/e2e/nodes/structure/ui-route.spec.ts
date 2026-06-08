import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P89 (ui-route) — fresh per-node E2E spec per .ai/agents/node-testing.md.
 *
 * Replaces the P42 spec. Covers:
 *   - App root "/" (implicit ui-app route) renders at /webapp/:appId/
 *   - Sub-route at "/customers" renders at /webapp/:appId/customers
 *   - Two routes — navigating shows the correct content for each
 *   - layoutId "grid" vs "vertical" → correct wrapper class
 *   - title as literal string → appears in <title> element
 *   - title as literal binding object → appears in <title> element
 *   - title absent → fallback to route id in <title> element
 *   - P48: "/" path is reserved (path "/" must be rejected by editor; runtime test
 *     only tests valid paths)
 *
 * Test catalogue: tests/e2e/nodes/structure/ui-route.tests.md
 */

test.describe("ui-route (P89)", () => {
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
        const flow = new FlowBuilder()
            .app({ id: "routeApp3", root: "routeApp3", name: "Multi-Route App", layout: "vertical" })
            .node("ui-text", { id: "routeHomeText3", text: "Home page" })
            .route({ id: "routeAbout3", path: "/about" })
            .node("ui-text", { id: "routeAboutText3", text: "About page" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp3");

        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home page");
        await expect(webapp.root()).not.toContainText("About page");

        await webapp.navigate("/about");
        await expect(webapp.root()).toContainText("About page");
        await expect(webapp.root()).not.toContainText("Home page");
    });

    test("layoutId 'grid' — webapp-layout--grid class in HTML", async ({ page, request }) => {
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

    test("layoutId 'vertical' — webapp-layout--vertical class in HTML", async ({ page, request }) => {
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

    // P89 (b): title as literal string (back-compat) → appears in <title>
    test("title as plain string — appears in page <title>", async ({ page, request }) => {
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

    // P89 (b): title as literal binding → resolved to string, appears in <title>
    test("title as literal binding { kind: 'literal', value } — appears in page <title>", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeApp7", root: "routeApp7", name: "Binding Title App", layout: "vertical" })
            .route({ id: "routeTitle7", path: "/binding-title", title: { kind: "literal", value: "Binding Title" } })
            .node("ui-text", { id: "routeBindText7", text: "Binding title content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp7");
        await webapp.navigate("/binding-title");
        await expect(page).toHaveTitle(/Binding Title/);
    });

    // P89 (b): dynamic binding → title resolves to undefined; fallback to route id in <title>
    test("title as state binding — <title> falls back to route id", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeApp8", root: "routeApp8", name: "Dynamic Title App", layout: "vertical" })
            .route({ id: "routeTitle8", path: "/dynamic-title", title: { kind: "state", path: "page.title" } })
            .node("ui-text", { id: "routeDynText8", text: "Dynamic title content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp8");
        await webapp.navigate("/dynamic-title");
        // When the title binding cannot be resolved server-side (state not available
        // at initial render), the <title> should contain the route id as fallback.
        await expect(page).toHaveTitle(/routeTitle8/);
    });

    // P89 (b): no title → fallback to route id in <title>
    test("no title — <title> shows route id as fallback", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "routeApp9", root: "routeApp9", name: "No Title App", layout: "vertical" })
            .route({ id: "routeNoTitle9", path: "/no-title" })
            .node("ui-text", { id: "routeNoTitleText9", text: "No title content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "routeApp9");
        await webapp.navigate("/no-title");
        await expect(page).toHaveTitle(/routeNoTitle9/);
    });
});
