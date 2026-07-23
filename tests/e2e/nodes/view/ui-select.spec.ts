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
                options: { kind: "literal", value: [
                    { label: "Germany", value: "de" },
                    { label: "France", value: "fr" }
                ] }
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
                options: { kind: "literal", value: [{ label: "A", value: "a" }] }
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
                options: { kind: "literal", value: [
                    { label: "EN", value: "en" },
                    { label: "DE", value: "de" }
                ] }
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
                options: { kind: "literal", value: [
                    { label: "EN", value: "en" },
                    { label: "DE", value: "de" }
                ] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selValApp1");
        await webapp.navigate("/");
        // The sl-select should have the initial value "de" set. Poll the property:
        // `toBeVisible` can pass before the Shoelace upgrade initialises `.value`
        // from the attribute, so a one-shot read raced under full-suite load
        // (observed 2026-07-23: "" !== "de" at test #744, green in isolation).
        await expect(page.locator("sl-select")).toBeVisible();
        await expect.poll(async () =>
            page.locator("sl-select").evaluate((el: HTMLElement & { value: string }) => el.value)
        , { timeout: 5000 }).toBe("de");
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
                options: { kind: "literal", value: [{ label: "EN", value: "en" }] }
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
                options: { kind: "literal", value: [{ label: "A", value: "a" }] }
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
                options: { kind: "literal", value: [{ label: "A", value: "a" }] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selDisApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-select:not([disabled])")).toBeVisible();
    });

    test("P124: disabled store-binding truthy → sl-select[disabled]", async ({ page, request }) => {
        // A ui-store initialised truthy → disabled binding (path = store node id)
        // resolves truthy from the store → sl-select renders with [disabled].
        // NOTE: a `store` binding's `path` is the ui-store NODE id (resolved to its
        // statePath, then read live), NOT a key inside the store value object.
        const flow = new FlowBuilder()
            .app({ id: "selDisApp3", root: "selDisApp3" })
            .node("ui-store", {
                id: "selStore3",
                statePath: "isLocked",
                initialValue: JSON.stringify(true)
            })
            .node("ui-select", {
                id: "selDisNode3",
                label: "Store Locked",
                disabled: { kind: "store", path: "selStore3" },
                options: { kind: "literal", value: [{ label: "A", value: "a" }] }
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
                options: { kind: "literal", value: [
                    { label: "EN", value: "en" },
                    { label: "DE", value: "de" }
                ] }
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

    // ─── P133: Options (json|store), placeholder/label bindings, searchable gone ──

    test("P133: Options json — object-map form { label: value } renders sl-options", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p133ObjApp", root: "p133ObjApp" })
            .node("ui-select", {
                id: "p133ObjNode",
                label: "Country",
                // Form 1: object map { label: value }.
                options: { kind: "literal", value: { Germany: "de", France: "fr" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133ObjApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toBeVisible();
        await expect(page.locator("sl-option[value='de']")).toBeAttached();
        await expect(page.locator("sl-option[value='fr']")).toBeAttached();
    });

    test("P133: Options json — string-array form ['A','B'] renders value=label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p133StrApp", root: "p133StrApp" })
            .node("ui-select", {
                id: "p133StrNode",
                label: "Pick",
                // Form 2: array of strings → value = label.
                options: { kind: "literal", value: ["Alpha", "Beta"] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133StrApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-option[value='Alpha']")).toBeAttached();
        await expect(page.locator("sl-option[value='Beta']")).toBeAttached();
    });

    test("P133: Options store-binding renders options reactively from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p133StoreApp", root: "p133StoreApp" })
            .node("ui-store", {
                id: "p133OptStore",
                statePath: "countryOptions",
                initialValue: JSON.stringify([
                    { label: "Germany", value: "de" },
                    { label: "Spain", value: "es" }
                ])
            })
            .node("ui-select", {
                id: "p133StoreNode",
                label: "Country",
                // store binding: path = the ui-store NODE id.
                options: { kind: "store", path: "p133OptStore" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133StoreApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toBeVisible();
        await expect(page.locator("sl-option[value='de']")).toBeAttached();
        await expect(page.locator("sl-option[value='es']")).toBeAttached();
    });

    test("P133: legacy optionsBinding migrates to a (state) options binding — app does not crash", async ({ page, request }) => {
        // Legacy config: optionsBinding string → stateBinding(path). Without a live
        // store feeding the path the select renders with no options but must not crash.
        const flow = new FlowBuilder()
            .app({ id: "p133LegBindApp", root: "p133LegBindApp" })
            .node("ui-select", {
                id: "p133LegBindNode",
                label: "Legacy Binding",
                optionsBinding: "data.options"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133LegBindApp");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-select")).toBeVisible();
    });

    test("P133: placeholder literal renders as sl-select[placeholder]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p133PhApp", root: "p133PhApp" })
            .node("ui-select", {
                id: "p133PhNode",
                label: "Lang",
                placeholder: { kind: "literal", value: "Choose a language" },
                options: { kind: "literal", value: [{ label: "EN", value: "en" }] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133PhApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toHaveAttribute("placeholder", "Choose a language");
    });

    test("P133: placeholder store-binding shows the live value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p133PhStoreApp", root: "p133PhStoreApp" })
            .node("ui-store", {
                id: "p133PhStore",
                statePath: "hint",
                initialValue: JSON.stringify("Pick one (live)")
            })
            .node("ui-select", {
                id: "p133PhStoreNode",
                label: "Lang",
                placeholder: { kind: "store", path: "p133PhStore" },
                options: { kind: "literal", value: [{ label: "EN", value: "en" }] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133PhStoreApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toHaveAttribute("placeholder", "Pick one (live)");
    });

    test("P133: label store-binding shows the live value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p133LblStoreApp", root: "p133LblStoreApp" })
            .node("ui-store", {
                id: "p133LblStore",
                statePath: "fieldLabel",
                initialValue: JSON.stringify("Country (live)")
            })
            .node("ui-select", {
                id: "p133LblStoreNode",
                label: { kind: "store", path: "p133LblStore" },
                options: { kind: "literal", value: [{ label: "EN", value: "en" }] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133LblStoreApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toHaveAttribute("label", "Country (live)");
    });

    test("P133: legacy `searchable:true` config loads without error", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p133SearchApp", root: "p133SearchApp" })
            .node("ui-select", {
                id: "p133SearchNode",
                label: "Old",
                searchable: true,
                options: { kind: "literal", value: [{ label: "A", value: "a" }] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p133SearchApp");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-select")).toBeVisible();
    });

    // ─── writeTo write-back (P204 / ADR 0027) — measured, no wiring ────────────

    test("W01 — selecting an option with writeTo=store persists it and a second bound view updates live", async ({ page, request }) => {
        // A ui-select writes store(wbStore).choice; a second ui-text reads
        // store(wbStore).choice. A select has no submit gesture → it writes on
        // change regardless of writeTrigger (here submit). Measured proof: the
        // ui-text CONTENT changes over SSE with NO function wiring.
        const flow = new FlowBuilder()
            .app({ id: "selWbApp", root: "selWbApp" })
            .node("ui-store", { id: "selWbStore", statePath: "form", initialValue: JSON.stringify({ choice: "a" }) })
            .node("ui-select", {
                id: "selWbIn",
                label: "Choose",
                options: { kind: "literal", value: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
                value: { kind: "store", path: "selWbStore", subPath: { kind: "literal", value: "choice" } },
                writeTo: { kind: "store", path: "selWbStore", subPath: { kind: "literal", value: "choice" } },
                writeTrigger: "submit"
            })
            .node("ui-text", {
                id: "selWbOut",
                value: { kind: "store", path: "selWbStore", subPath: { kind: "literal", value: "choice" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selWbApp");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toContainText("a");

        await page.evaluate(() => {
            const el = document.querySelector("sl-select") as HTMLElement & { value: string };
            el.value = "b";
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });

        await expect(webapp.root().locator(".webapp-text")).toContainText("b", { timeout: 5000 });
    });
});
