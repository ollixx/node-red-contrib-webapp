import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * ui-menu — per-node E2E spec (rewritten at P157, Field-Typing Welle 2).
 *
 * P157 (ADR 0012): `items` is the canonical STRUCTURAL array value typedInput —
 * the menu renders its entries ITSELF (no slot-per-item; NOT a repeats case). It
 * accepts a json-literal array OR a Store/Query/Reactive binding, resolved
 * structurally (the SAME path P133 added for ui-select `options`). `activeRoute`
 * is a read-only value typedInput that highlights the matching item. The legacy
 * `itemsPath` / `activeRoutePath` plain state paths migrate to state bindings.
 *
 * Covers: literal-array items, store-array items (reactive), activeRoute
 * highlight (store), legacy-path migration, plus the P75 navigate/href behaviour.
 */

test.describe("ui-menu — items (structural array) + activeRoute (P157)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("json-literal items array renders the sl-menu entries", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuLitApp", root: "menuLitApp" })
            .node("ui-menu", {
                id: "menuLitNode",
                items: { kind: "literal", value: [
                    { label: "Home", route: "/" },
                    { label: "About", route: "/about" }
                ] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuLitApp");
        await webapp.navigate("/");

        await expect(page.locator("sl-menu")).toBeVisible();
        const items = page.locator("sl-menu sl-menu-item");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText("Home");
        await expect(items.nth(1)).toContainText("About");
    });

    test("store-array items render the menu entries reactively", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuStoreApp", root: "menuStoreApp" })
            .node("ui-store", {
                id: "menuItemsStore",
                statePath: "navItems",
                initialValue: JSON.stringify([
                    { label: "Dashboard", route: "/dashboard" },
                    { label: "Customers", route: "/customers" }
                ])
            })
            .node("ui-menu", {
                id: "menuStoreNode",
                // store binding: path = the ui-store NODE id; the whole array slice
                // is read structurally (not coerced by the display-scalar guard).
                items: { kind: "store", path: "menuItemsStore" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuStoreApp");
        await webapp.navigate("/");

        await expect(page.locator("sl-menu")).toBeVisible();
        const items = page.locator("sl-menu sl-menu-item");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText("Dashboard");
        await expect(items.nth(1)).toContainText("Customers");
        await expect(page.locator("sl-menu-item[data-webapp-navigate-path='/customers']")).toBeAttached();
    });

    test("activeRoute from a store marks the matching item active", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuActiveApp", root: "menuActiveApp" })
            .node("ui-store", {
                id: "menuActiveStore",
                statePath: "activeRoute",
                initialValue: JSON.stringify("/customers")
            })
            .node("ui-menu", {
                id: "menuActiveNode",
                items: { kind: "literal", value: [
                    { label: "Home", route: "/" },
                    { label: "Customers", route: "/customers" }
                ] },
                activeRoute: { kind: "store", path: "menuActiveStore" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuActiveApp");
        await webapp.navigate("/");

        // the "/customers" item carries the active markers; "/" (Home) does not.
        await expect(
            page.locator("sl-menu-item[data-webapp-navigate-path='/customers'][aria-current='page']")
        ).toBeAttached();
        await expect(
            page.locator("sl-menu-item[data-webapp-navigate-path='/'][aria-current='page']")
        ).toHaveCount(0);
    });

    test("legacy itemsPath migrates to a state binding and renders from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuMigApp", root: "menuMigApp" })
            .node("ui-store", {
                id: "menuMigStore",
                statePath: "nav",
                initialValue: JSON.stringify({ items: [{ label: "Reports", route: "/reports" }] })
            })
            .node("ui-menu", {
                id: "menuMigNode",
                // legacy plain state-path field — migrates to { kind:"state", path }.
                itemsPath: "nav.items"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuMigApp");
        await webapp.navigate("/");

        await expect(page.locator("sl-menu sl-menu-item").first()).toContainText("Reports");
    });

    // P75 — clicking a route item dispatches a `navigate` event with params.path.
    test("click on a route item POSTs /event { event:'navigate', params:{ path } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuNavApp", root: "menuNavApp" })
            .node("ui-menu", {
                id: "menuNavNode",
                items: { kind: "literal", value: [
                    { label: "Dashboard", route: "/dashboard" },
                    { label: "Customers", route: "/customers" }
                ] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuNavApp");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("sl-menu-item[data-webapp-navigate-path]").first().click();

        const body = await eventPromise;
        expect(body.event).toBe("navigate");
        expect(body.sourceId).toBe("menuNavNode");
        expect((body.params as Record<string, unknown>).path).toBe("/dashboard");
    });

    // P75 — external href items carry no navigate hook (the browser opens them).
    test("external href item carries no navigate hook", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "menuHrefApp", root: "menuHrefApp" })
            .node("ui-menu", {
                id: "menuHrefNode",
                items: { kind: "literal", value: [{ label: "External", href: "https://example.com" }] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "menuHrefApp");
        await webapp.navigate("/");

        await expect(page.locator("sl-menu-item").first()).toContainText("External");
        await expect(page.locator("sl-menu-item[data-webapp-navigate-path]")).toHaveCount(0);
    });
});
