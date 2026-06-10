import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-select (interactive view node).
 *
 * Covers:
 *   - rendering: sl-select is visible with label and sl-option elements.
 *   - events: sl-change → POST /event { event:"change", params:{ value: string } }.
 *
 * P82: inject → value update behaviour is covered by classic unit tests
 * (packages/runtime/test/p82-input-nodes-behaviour.test.ts).
 *
 * P124 (ADR 0012): value→canonical typedInput (full binding set), valuePath
 * migration, and bindable disabled (boolean-state category incl. Store).
 */

test.describe("ui-select (P44 + P124)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-select with label and sl-option elements", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selApp1", root: "selApp1" })
            .node("ui-select", {
                id: "selNode1",
                label: "Country",
                optionsJson: JSON.stringify([
                    { label: "Germany", value: "de" },
                    { label: "France", value: "fr" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toBeVisible();
        await expect(page.locator("sl-select")).toHaveAttribute("label", "Country");
        await expect(page.locator("sl-option[value='de']")).toBeAttached();
        await expect(page.locator("sl-option[value='fr']")).toBeAttached();
    });

    test("disabled renders sl-select[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selApp2", root: "selApp2" })
            .node("ui-select", {
                id: "selNode2",
                label: "Locked",
                disabled: { kind: "literal", value: true },
                optionsJson: JSON.stringify([{ label: "A", value: "a" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-select[disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selApp3", root: "selApp3" })
            .node("ui-select", {
                id: "selNode3",
                label: "Lang",
                optionsJson: JSON.stringify([
                    { label: "EN", value: "en" },
                    { label: "DE", value: "de" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-select") as HTMLElement & { value: string };
            if (el) {
                el.value = "de";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("de");
    });

    // ─── P124: value binding (full canonical set) ─────────────────────────────

    test("P124: value={kind:'literal',value:'de'} → sl-select renders with initial value 'de'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selValApp1", root: "selValApp1" })
            .node("ui-select", {
                id: "selValNode1",
                label: "Lang",
                value: { kind: "literal", value: "de" },
                optionsJson: JSON.stringify([
                    { label: "EN", value: "en" },
                    { label: "DE", value: "de" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selValApp1");
        await webapp.navigate("/");
        // The sl-select should have the initial value "de" set.
        await expect(page.locator("sl-select")).toBeVisible();
        const val = await page.locator("sl-select").evaluate((el: HTMLElement & { value: string }) => el.value);
        expect(val).toBe("de");
    });

    test("P124: valuePath migration — legacy valuePath config resolves value as state binding", async ({ page, request }) => {
        // A node config with legacy `valuePath` (no `value` binding object set).
        // webapp.js falls back to stateBinding(valuePath) in mapConfig, so the
        // rendered snapshot carries a state binding for the path. Without a live
        // store providing the value the field renders empty but does NOT crash.
        const flow = new FlowBuilder()
            .app({ id: "selValApp2", root: "selValApp2" })
            .node("ui-select", {
                id: "selValNode2",
                label: "Legacy",
                valuePath: "selectedLang",
                optionsJson: JSON.stringify([{ label: "EN", value: "en" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selValApp2");
        await webapp.navigate("/");
        // App must not crash; sl-select must be present (state resolves to undefined → no initial selection).
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-select")).toBeVisible();
    });

    // ─── P124: disabled binding (boolean-state category) ─────────────────────

    test("P124: disabled={kind:'literal',value:true} → sl-select[disabled] visible", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selDisApp1", root: "selDisApp1" })
            .node("ui-select", {
                id: "selDisNode1",
                label: "Locked",
                disabled: { kind: "literal", value: true },
                optionsJson: JSON.stringify([{ label: "A", value: "a" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selDisApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-select[disabled]")).toBeVisible();
    });

    test("P124: disabled={kind:'literal',value:false} → sl-select has NO disabled attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selDisApp2", root: "selDisApp2" })
            .node("ui-select", {
                id: "selDisNode2",
                label: "Enabled",
                disabled: { kind: "literal", value: false },
                optionsJson: JSON.stringify([{ label: "A", value: "a" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selDisApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-select:not([disabled])")).toBeVisible();
    });

    test("P124: disabled store-binding truthy → sl-select[disabled]", async ({ page, request }) => {
        // A ui-store initialised to { isLocked: true } → disabled binding resolves
        // truthy from the store → sl-select renders with [disabled].
        const flow = new FlowBuilder()
            .app({ id: "selDisApp3", root: "selDisApp3" })
            .store({ id: "selStore3", initial: JSON.stringify({ isLocked: true }) })
            .node("ui-select", {
                id: "selDisNode3",
                label: "Store Locked",
                disabled: { kind: "store", path: "isLocked" },
                optionsJson: JSON.stringify([{ label: "A", value: "a" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selDisApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-select[disabled]")).toBeVisible();
    });

    // ─── P124: round-trip — change event still works after migration ──────────

    test("P124: change event functional with value binding present", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selRTApp", root: "selRTApp" })
            .node("ui-select", {
                id: "selRTNode",
                label: "Round-trip",
                value: { kind: "literal", value: "en" },
                optionsJson: JSON.stringify([
                    { label: "EN", value: "en" },
                    { label: "DE", value: "de" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selRTApp");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-select") as HTMLElement & { value: string };
            if (el) {
                el.value = "de";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("de");
    });
});
