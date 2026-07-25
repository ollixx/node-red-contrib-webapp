import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P87 — fresh per-node E2E tests for ui-app (replaces P42 tests).
 *
 * Written fresh to .ai/agents/node-testing.md standard: outcome-based, each test
 * turns red if the described feature is removed.
 *
 * Covered:
 *   1. Minimal config (root, name) → app-bar title rendered.
 *   2. tokens.colorPrimary → CSS custom property applied.
 *   3. Missing root → /webapp/:id returns 404.
 *   4. layout "app" → app-bar + slot chrome.
 *   5. layout "plain" (vertical) → no app-bar.
 *   6. App-bar persists across routes with non-"app" layoutId.
 *   7. P87: clientId persisted in localStorage — reload reuses same id.
 *   8. P87: clientId is scoped per appId (two apps get different keys).
 */

test.describe("ui-app", () => {
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
        // uses layout: "vertical" must still show the app-bar when the app
        // itself has layout: "app".
        // P48: "/" is the implicit app root; the sub-route uses layoutId "vertical".
        const flow = new FlowBuilder()
            .app({ id: "appBarPersist", root: "appBarPersist", name: "Persistent Bar", layout: "app" })
            .route({ id: "appBarPersistSub", path: "/sub", layout: "vertical" })
            .node("ui-text", { id: "appBarPersistText", text: "Sub page" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appBarPersist");
        await webapp.navigate("/sub");

        // App-bar must be visible even though the route uses layoutId "vertical".
        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        await expect(page.locator(".webapp-app-bar-title")).toHaveText("Persistent Bar");
    });

    // ── P87: clientId localStorage persistence ──────────────────────────────
    //
    // The clientId is stored under "webapp:clientId:<appId>" after the first
    // page load. Reloading or reconnecting reuses the stored id so per-client
    // server state (clientStateMap, P15) survives browser reloads.

    test("P87: clientId is persisted in localStorage — reload reuses the same id", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "appPersistId", root: "appPersistId", name: "Persist ID App", layout: "app" })
            .build();

        await deployFlow(request, flow);

        // First load: generate and store the clientId.
        const webapp = new WebappPage(page, "appPersistId");
        await webapp.navigate("/");

        const firstClientId: string = await page.evaluate(() =>
            localStorage.getItem("webapp:clientId:appPersistId") ?? ""
        );
        // Outcome: localStorage key must be set with a client- prefixed value.
        expect(firstClientId).toMatch(/^client-/);

        // Reload: must reuse the same clientId (not generate a new one).
        await webapp.navigate("/");
        const reloadClientId: string = await page.evaluate(() =>
            localStorage.getItem("webapp:clientId:appPersistId") ?? ""
        );
        // Outcome: the stored key must not change across reloads.
        expect(reloadClientId).toBe(firstClientId);
    });

    test("P87: clientId key is scoped per appId — two apps get distinct keys", async ({ page, request }) => {
        const flow = [
            ...new FlowBuilder()
                .app({ id: "appScopeA", root: "appScopeA", name: "App A", layout: "app" })
                .build(),
            ...new FlowBuilder()
                .app({ id: "appScopeB", root: "appScopeB", name: "App B", layout: "app" })
                .build()
        ];

        await deployFlow(request, flow);

        // Visit App A.
        const webappA = new WebappPage(page, "appScopeA");
        await webappA.navigate("/");
        const idA: string = await page.evaluate(() =>
            localStorage.getItem("webapp:clientId:appScopeA") ?? ""
        );
        expect(idA).toMatch(/^client-/);

        // Visit App B (same origin → same localStorage).
        const webappB = new WebappPage(page, "appScopeB");
        await webappB.navigate("/");
        const idB: string = await page.evaluate(() =>
            localStorage.getItem("webapp:clientId:appScopeB") ?? ""
        );
        expect(idB).toMatch(/^client-/);

        // Outcome: two apps must have independent clientIds.
        expect(idA).not.toBe(idB);

        // Outcome: App A's key must be unaffected by visiting App B.
        const idAAfter: string = await page.evaluate(() =>
            localStorage.getItem("webapp:clientId:appScopeA") ?? ""
        );
        expect(idAAfter).toBe(idA);
    });

    // ── P109: name/root/title rework ────────────────────────────────────────

    test("P109: HTML <title> element shows the app's name", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "appTitle109", root: "appTitle109", name: "My App Name", layout: "app" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appTitle109");
        await webapp.navigate("/");

        // Outcome: <title> starts with the app's name field.
        const pageTitle = await page.title();
        expect(pageTitle).toContain("My App Name");
    });

    test("P109: header-slot empty → name shown as title in app-bar", async ({ page, request }) => {
        // When no children are mounted in the header slot, the app-bar must show
        // the app's `name` as its title text.
        const flow = new FlowBuilder()
            .app({ id: "appNoHeader", root: "appNoHeader", name: "No Header App", layout: "app" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appNoHeader");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        // Outcome: the app-bar shows the name.
        await expect(page.locator(".webapp-app-bar-title")).toHaveText("No Header App");
    });

    test("P109: header-slot has children → no name title in app-bar, only slot content", async ({ page, request }) => {
        // When ≥1 child is mounted in the header slot, the app-bar must NOT
        // show the app's `name` — only the slot children are rendered.
        const flow = new FlowBuilder()
            .app({ id: "appWithHeader", root: "appWithHeader", name: "Header Slot App", layout: "app" })
            .node("ui-text", {
                id: "hdrContent",
                text: "Custom Header Content",
                mount: "appWithHeader.header"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appWithHeader");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-app-bar")).toBeVisible();
        // Outcome: the app-bar-title span must NOT be present (no name shown).
        await expect(page.locator(".webapp-app-bar-title")).not.toBeVisible();
        // Outcome: the header slot content is rendered.
        await expect(page.locator(".webapp-slot--header")).toContainText("Custom Header Content");
    });

    // ── Issue #4: the app-bar name links to the app root ────────────────────

    test("issue #4: app-bar name is a link whose href is the app root", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "appBarLink", root: "appBarLink", name: "Linked App", layout: "app" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appBarLink");
        await webapp.navigate("/");

        const title = page.locator(".webapp-app-bar-title");
        await expect(title).toHaveText("Linked App");

        // Outcome: it is an anchor, and the href RESOLVES to the app root — asserted
        // on the resolved URL, not on the raw attribute string.
        const resolved = await title.evaluate((el) => ({
            tag: el.tagName.toLowerCase(),
            href: (el as HTMLAnchorElement).href
        }));
        expect(resolved.tag).toBe("a");
        expect(new URL(resolved.href).pathname.replace(/\/$/, "")).toBe("/webapp/appBarLink");

        // Outcome: the click target is the TEXT, not the whole bar. The old span
        // carried flex:1 and would have stretched the anchor across the app bar.
        const titleBox = await title.boundingBox();
        const barBox = await page.locator(".webapp-app-bar").boundingBox();
        expect(titleBox).not.toBeNull();
        expect(barBox).not.toBeNull();
        expect(titleBox!.width).toBeLessThan(barBox!.width * 0.5);
    });

    test("issue #4: clicking the app-bar name from a sub-route lands on the app root", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "appBarHome", root: "appBarHome", name: "Home Link", layout: "app" })
            .node("ui-text", { id: "appBarHomeRoot", text: "Root page content" })
            .route({ id: "appBarHomeSub", path: "/sub" })
            .node("ui-text", { id: "appBarHomeSubText", text: "Sub page content" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "appBarHome");
        await webapp.navigate("/sub");
        await expect(webapp.root()).toContainText("Sub page content");

        // Outcome: the click actually navigates — the root route's content renders
        // and the browser URL is the app root.
        await page.locator(".webapp-app-bar-title").click();
        await expect(webapp.root()).toContainText("Root page content");
        expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe("/webapp/appBarHome");
    });
});
