import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P42 — per-node E2E specs for ui-app (structure node).
 *
 * Each test is isolated: it deploys its own minimal flow, then resets after.
 * The spec covers the properties documented in the P42 scope:
 *   - Minimal config (root, name) → /webapp/:id serves a 200 with app-bar title.
 *   - tokens.colorPrimary → CSS custom property applied to app bar background.
 *   - Missing root → no app registered, /webapp/:id returns 404.
 *   - layout "app" → app-bar + slot chrome renders.
 *   - layout "plain" → no app-bar rendered.
 *   - app-bar persists when navigating to a route with a non-"app" layoutId.
 */

test.describe("ui-app (P42)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("minimal config — app-bar visible with title", async ({ page, request }) => {
        // P48: the app node's layout field drives the implicit root route's layout
        // via createAppRootRoute — no explicit ui-route for "/" is needed (or allowed).
        const flow = new FlowBuilder()
            .app({ id: "appMinimal", root: "appMinimal", name: "My App", layout: "app" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appMinimal");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        await expect(page.locator(".webapp-app-bar-title")).toHaveText("My App");
    });

    test("tokens.colorPrimary — CSS custom property applied to app bar background", async ({ page, request }) => {
        // Set a distinctive purple primary colour so the assertion is unambiguous.
        const flow = new FlowBuilder()
            .app({
                id: "appTokens",
                root: "appTokens",
                name: "Token App",
                layout: "app",
                tokens: JSON.stringify({ colorPrimary: "#7c3aed" })
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appTokens");
        await webapp.navigate("/");

        const appBar = page.locator(".webapp-app-bar");
        await expect(appBar).toBeVisible();

        // The CSS custom property --wa-color-primary must be overridden to
        // #7c3aed → rgb(124,58,237). The app bar background uses that property.
        const bgColor = await appBar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        expect(bgColor).toBe("rgb(124, 58, 237)");
    });

    test("missing root — /webapp/:id returns 404", async ({ request }) => {
        // Deploy a flow with no ui-app node — only a tab.
        await deployFlow(request, [
            { id: "e2e-flow", type: "tab", label: "E2E", disabled: false, info: "" }
        ]);

        const res = await request.get("/webapp/noSuchApp/");
        expect(res.status()).toBe(404);
    });

    test("layout preset 'app' — app-bar and slot chrome render", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "appLayoutApp", root: "appLayoutApp", name: "Shell App", layout: "app" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appLayoutApp");
        await webapp.navigate("/");

        // The 'app' preset renders an app-bar shell and slot sections.
        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        await expect(page.locator(".webapp-layout--app")).toBeVisible();
    });

    test("layout preset 'plain' — no app-bar rendered", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "appLayoutPlain", root: "appLayoutPlain", name: "Plain App", layout: "vertical" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appLayoutPlain");
        await webapp.navigate("/");

        // The 'vertical' (plain) layout has no app-bar.
        await expect(page.locator(".webapp-app-bar")).not.toBeVisible();
        // The content root must still render.
        await expect(webapp.root()).toBeVisible();
    });

    test("app-bar persists on routes with non-'app' layoutId", async ({ page, request }) => {
        // The app-bar is driven by the ui-app node's layout field, NOT by the
        // individual route's layoutId. This means navigating to a route that
        // uses layoutId: "vertical" must still show the app-bar when the app
        // itself has layout: "app".
        // P48: "/" is the implicit app root; the sub-route uses layoutId "vertical".
        const flow = new FlowBuilder()
            .app({ id: "appBarPersist", root: "appBarPersist", name: "Persistent Bar", layout: "app" })
            .route({ id: "appBarPersistSub", path: "/sub", layoutId: "vertical" })
            .node("ui-text", { id: "appBarPersistText", text: "Sub page" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appBarPersist");
        await webapp.navigate("/sub");

        // App-bar must be visible even though the route uses layoutId "vertical".
        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        await expect(page.locator(".webapp-app-bar-title")).toHaveText("Persistent Bar");
    });
});
