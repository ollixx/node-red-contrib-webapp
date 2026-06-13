import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * ui-list — per-node E2E spec (rewritten at P171, ui-list/spec alignment).
 *
 * P171 (ADR 0012): `items` is a STRUCTURAL array value typedInput (the list
 * renders its rows ITSELF — NOT a repeats case), exactly like ui-menu `items`.
 * Each element is a String shorthand (→ {label}) OR an object
 * {id?,label,value?,icon?}. `label` is required (object form); a missing label
 * renders "?" for THAT row only; a non-array root → empty list (no crash). The
 * node-wide `displayValue` (none/secondary/badge) controls how a row's `value`
 * is DISPLAYED; `value` is ALWAYS carried in the itemClick event (row.value).
 * The itemClick event emits params { rowId, row }. Legacy `itemsPath` migrates
 * to a state binding.
 */

test.describe("ui-list — items typedInput + item schema (P171)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("array of strings renders one labelled row per string", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listStrApp", root: "listStrApp" })
            .node("ui-list", {
                id: "listStrNode",
                items: { kind: "literal", value: ["Ada", "Alan"] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listStrApp");
        await webapp.navigate("/");

        await expect(page.locator("ul.webapp-list")).toBeVisible();
        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText("Ada");
        await expect(items.nth(1)).toContainText("Alan");
    });

    test("mixed array (string + object) renders; missing label → '?' for that row only", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listMixApp", root: "listMixApp" })
            .node("ui-list", {
                id: "listMixNode",
                items: { kind: "literal", value: [
                    "Shortcut",
                    { id: "c-1", label: "Open invoices" },
                    { id: "c-2", value: 7 }
                ] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listMixApp");
        await webapp.navigate("/");

        const items = page.locator("ul.webapp-list li.webapp-list-item");
        await expect(items).toHaveCount(3);
        await expect(items.nth(0)).toContainText("Shortcut");
        await expect(items.nth(1)).toContainText("Open invoices");
        // The third element has no label → "?" for that row only (the others render).
        await expect(items.nth(2)).toContainText("?");
    });

    test("object items with value + displayValue=badge render a badge in badgeVariant", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listBadgeApp", root: "listBadgeApp" })
            .node("ui-list", {
                id: "listBadgeNode",
                items: { kind: "literal", value: [
                    { id: "c-1", label: "Open invoices", value: 3 },
                    { id: "c-2", label: "Paid", value: 12 }
                ] },
                displayValue: "badge",
                badgeVariant: "warning"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listBadgeApp");
        await webapp.navigate("/");

        // value renders as an sl-badge inside the row, in the configured variant.
        const badges = page.locator("ul.webapp-list li.webapp-list-item sl-badge.webapp-list-value");
        await expect(badges).toHaveCount(2);
        await expect(badges.nth(0)).toContainText("3");
        await expect(badges.nth(1)).toContainText("12");
        // "warning" maps to the Shoelace variant the badge serializer emits.
        await expect(badges.first()).toHaveAttribute("variant", "warning");
    });

    test("legacy itemsPath migrates to a state binding and renders from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listMigApp", root: "listMigApp" })
            .node("ui-store", {
                id: "listMigStore",
                statePath: "people",
                initialValue: JSON.stringify([{ label: "Grace" }])
            })
            .node("ui-list", {
                id: "listMigNode",
                // legacy plain state-path field — migrates to { kind:"state", path }.
                itemsPath: "people"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listMigApp");
        await webapp.navigate("/");

        await expect(page.locator("ul.webapp-list li.webapp-list-item").first()).toContainText("Grace");
    });

    test("non-array root resolves to an empty list without crashing", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listScalarApp", root: "listScalarApp" })
            .node("ui-store", {
                id: "listScalarStore",
                statePath: "notAnArray",
                initialValue: JSON.stringify("hello")
            })
            .node("ui-list", {
                id: "listScalarNode",
                items: { kind: "store", path: "listScalarStore" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listScalarApp");
        await webapp.navigate("/");

        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("ul.webapp-list li.webapp-list-item")).toHaveCount(0);
    });

    test("itemClick event emits params { rowId, row } with the whole element incl. value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "listClickApp", root: "listClickApp" })
            .node("ui-list", {
                id: "listClickNode",
                items: { kind: "literal", value: [
                    { id: "fruit-1", label: "Cherry", value: 5 },
                    { id: "fruit-2", label: "Date", value: 9 }
                ] },
                events: JSON.stringify(["itemClick"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "listClickApp");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("ul.webapp-list li.webapp-list-item a.webapp-link").first().click();

        const body = await eventPromise;
        expect(body.event).toBe("itemClick");
        expect(body.sourceId).toBe("listClickNode");
        const params = body.params as Record<string, unknown>;
        // rowId = id (else index); row = whole element incl. value.
        expect(params.rowId).toBe("fruit-1");
        const row = params.row as Record<string, unknown>;
        expect(row.label).toBe("Cherry");
        expect(row.value).toBe(5);
    });
});
