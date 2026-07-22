import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P256 — MEASURE the three previously-unproven ui-action verbs against the real
 * DOM: `focus`, `select`, `reset`.
 *
 * MEASUREMENT OUTCOME (2026-07-21):
 *   • focus  → HAS an observable effect (input control receives focus). Proven
 *              by the green test below.
 *   • select → IMPLEMENTED in P257 (owner decision: implement, not remove). The
 *              serializer stamps a resolvable `data-webapp-part` hook on the
 *              ACTIVATING element of each single-active node (nav tab / step
 *              button / menu item / table row) and the client `select` resolves
 *              the part to that element and triggers its native activation. See
 *              the per-node-type green tests below. ui-table reuses the existing
 *              rowSelect event path (it has no persistent per-row active-state).
 *   • reset  → IMPLEMENTED in P258 (owner decision 2026-07-21: implement). The
 *              client freezes each form control's first-seen INITIAL value and, on
 *              reset, restores it + fires the control's change event so a bound
 *              store re-syncs. "Initial" = store-initial for a BOUND control,
 *              rendered `value` for an UNBOUND control (both = the deploy-time
 *              served value). Non-form targets (ui-app/ui-route/display) are a
 *              documented no-op. See the per-control measured tests below.
 */

test.describe("ui-action verbs focus / select / reset (P256)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── focus → the target input control receives focus (WORKS) ─────────────

    test("focus → the target ui-input control becomes document.activeElement", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p256FocusApp", root: "p256FocusApp" })
            .node("ui-input", { id: "p256FocusInput", label: { kind: "literal", value: "Name" } })
            .node("ui-action", { id: "p256FocusAct", actionType: "focus", target: "p256FocusInput" })
            .withInjectNode("p256FocusInj", "p256FocusAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p256FocusApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p256FocusInput"] sl-input');
        await expect(control).toBeVisible();
        // Nothing focused yet.
        await expect(control).not.toBeFocused();

        await injectMessage(request, "p256FocusInj");

        // The focus verb moves keyboard focus onto the input control.
        await expect(control).toBeFocused({ timeout: 5000 });
    });

    // ─── select → the named item becomes ACTIVE, per node type (P257) ─────────
    //
    // P257 (owner decision: implement, not remove). The serializer now stamps a
    // resolvable `data-webapp-part` hook on the ACTIVATING element of each
    // single-active node (nav tab / step button / menu item / table row) and the
    // client `select` resolves the part to that element and triggers its native
    // activation. Each test measures the real DOM active-state, distinct from the
    // pre-inject state.

    test("select(part) → the targeted ui-tabs tab becomes active", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p257TabApp", root: "p257TabApp" })
            .node("ui-tabs", { id: "p257Tabs" })
            .node("ui-tab", { id: "p257TabOv", mount: "ui-tabs:p257Tabs/content", label: { kind: "literal", value: "Overview" }, order: 0 })
            .node("ui-tab", { id: "p257TabDe", mount: "ui-tabs:p257Tabs/content", label: { kind: "literal", value: "Details" }, order: 1 })
            .node("ui-text", { id: "p257TabOvBody", mount: "ui-tab:p257TabOv/content", text: "Overview body" })
            .node("ui-text", { id: "p257TabDeBody", mount: "ui-tab:p257TabDe/content", text: "Details body" })
            .node("ui-action", { id: "p257TabAct", actionType: "select", target: "p257Tabs", part: "p257TabDe" })
            .withInjectNode("p257TabInj", "p257TabAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p257TabApp");
        await webapp.navigate("/");

        const ov = page.locator("sl-tab[panel='p257TabOv']");
        const de = page.locator("sl-tab[panel='p257TabDe']");
        await expect(ov).toBeVisible();
        // Default: first tab active, second inactive.
        await expect(ov).toHaveAttribute("active", "");
        await expect(de).not.toHaveAttribute("active", /.*/);

        await injectMessage(request, "p257TabInj");

        // The select verb activates the targeted NAV tab (measured `active` attr).
        await expect(de).toHaveAttribute("active", "", { timeout: 5000 });
    });

    test("select(part) → the targeted ui-stepper step becomes active", async ({ page, request }) => {
        const steps = JSON.stringify([
            { id: "s1", label: "Configure" },
            { id: "s2", label: "Review" },
            { id: "s3", label: "Deploy" }
        ]);
        const flow = new FlowBuilder()
            .app({ id: "p257StepApp", root: "p257StepApp" })
            .node("ui-stepper", { id: "p257Stepper", steps })
            .node("ui-action", { id: "p257StepAct", actionType: "select", target: "p257Stepper", part: "s3" })
            .withInjectNode("p257StepInj", "p257StepAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p257StepApp");
        await webapp.navigate("/");

        const buttons = page.locator(".webapp-stepper button.webapp-step");
        await expect(buttons).toHaveCount(3);
        // Default: first step active, third inactive.
        await expect(buttons.nth(0)).toHaveClass(/webapp-step--active/);
        await expect(buttons.nth(2)).not.toHaveClass(/webapp-step--active/);

        await injectMessage(request, "p257StepInj");

        // The select verb activates the targeted step (measured active class).
        await expect(buttons.nth(2)).toHaveClass(/webapp-step--active/, { timeout: 5000 });
        await expect(buttons.nth(0)).not.toHaveClass(/webapp-step--active/);
    });

    test("select(part) → the targeted ui-menu item is marked active", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p257MenuApp", root: "p257MenuApp" })
            .node("ui-menu", {
                id: "p257Menu",
                items: { kind: "literal", value: [
                    { label: "Home", route: "/" },
                    { label: "Customers", route: "/customers" }
                ] }
            })
            .node("ui-action", { id: "p257MenuAct", actionType: "select", target: "p257Menu", part: "/customers" })
            .withInjectNode("p257MenuInj", "p257MenuAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p257MenuApp");
        await webapp.navigate("/");

        const customers = page.locator("sl-menu-item[data-webapp-navigate-path='/customers']");
        await expect(customers).toBeVisible();
        // Default (no activeRoute configured): nothing marked active.
        await expect(customers).not.toHaveAttribute("data-webapp-active", /.*/);

        await injectMessage(request, "p257MenuInj");

        // The select verb marks the targeted menu item active (single-active).
        await expect(customers).toHaveAttribute("data-webapp-active", "true", { timeout: 5000 });
        await expect(customers).toHaveAttribute("aria-current", "page");
    });

    test("select(part) → the targeted ui-table row fires its rowSelect (reuses the rowSelect path)", async ({ page, request }) => {
        // P257 decision: ui-table `select` REUSES the existing rowSelect event path
        // (no second mechanism). A ui-table carries NO persistent per-row active
        // attribute (selection state lives on ui-list via aria-selected), so the
        // observable effect is the documented rowSelect EVENT — measured here.
        const flow = new FlowBuilder()
            .app({ id: "p257TblApp", root: "p257TblApp" })
            .node("ui-table", {
                id: "p257Table",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: { kind: "literal", value: [
                    { id: "r1", name: "Alice" },
                    { id: "r2", name: "Bob" }
                ] },
                events: JSON.stringify(["rowSelect"])
            })
            .node("ui-action", { id: "p257TblAct", actionType: "select", target: "p257Table", part: "r2" })
            .withInjectNode("p257TblInj", "p257TblAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p257TblApp");
        await webapp.navigate("/");

        await expect(page.locator("table.webapp-table tbody tr")).toHaveCount(2);
        // The selectable row carries the resolvable part hook.
        await expect(page.locator("tr[data-webapp-part='r2']")).toBeAttached();

        const eventPromise = webapp.interceptNextEvent();
        await injectMessage(request, "p257TblInj");

        // The select verb fires the row's native rowSelect for the targeted rowId.
        const body = await eventPromise;
        expect(body.event).toBe("rowSelect");
        expect((body.params as Record<string, unknown>).rowId).toBe("r2");
    });

    // ─── reset → the target form control returns to its INITIAL value (P258) ──
    //
    // P258 (owner decision 2026-07-21): the `reset` verb restores a form control's
    // live value to its INITIAL. "Initial" = the value first served (deploy-time):
    // for a store/state-BOUND control that is the STORE INITIAL value; for an
    // UNBOUND control it is the rendered `value` prop. ONE unified client mechanism
    // freezes each control's first-seen value and, on reset, sets it back + fires the
    // control's change event so a bound store re-syncs. Each test below MEASURES the
    // real control value returning to initial (not tags). For non-form targets the
    // verb is a documented no-op (proven at the end).

    test("reset → an UNBOUND ui-input value returns to its rendered initial (empty)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258InApp", root: "p258InApp" })
            .node("ui-input", { id: "p258In", label: "Name" })
            .node("ui-action", { id: "p258InAct", actionType: "reset", target: "p258In" })
            .withInjectNode("p258InInj", "p258InAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258InApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258In"] sl-input');
        await expect(control).toBeVisible();

        // Type scratch into the field.
        await control.click();
        await page.keyboard.type("scratch");
        await expect(control).toHaveJSProperty("value", "scratch");

        await injectMessage(request, "p258InInj");

        // reset restores the initial (empty) rendered value.
        await expect(control).toHaveJSProperty("value", "", { timeout: 5000 });
    });

    test("reset → an UNBOUND ui-input with a rendered initial returns to that value (not empty)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258SeedApp", root: "p258SeedApp" })
            .node("ui-input", { id: "p258Seed", label: "Name", value: { kind: "literal", value: "seed" } })
            .node("ui-action", { id: "p258SeedAct", actionType: "reset", target: "p258Seed" })
            .withInjectNode("p258SeedInj", "p258SeedAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258SeedApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Seed"] sl-input');
        await expect(control).toHaveJSProperty("value", "seed");

        // Replace the seeded value with scratch.
        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Seed"] sl-input') as HTMLElement & { value: string };
            el.value = "scratch";
            el.dispatchEvent(new CustomEvent("sl-input", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("value", "scratch");

        await injectMessage(request, "p258SeedInj");

        // reset restores the rendered initial value "seed" (proves "rendered value" path).
        await expect(control).toHaveJSProperty("value", "seed", { timeout: 5000 });
    });

    test("reset → a STORE-BOUND ui-input returns to the STORE INITIAL and re-syncs the store", async ({ page, request }) => {
        // Owner path 1: a bound control resets to the STORE INITIAL value, and the
        // fired change round-trips through the store so a second bound view re-syncs.
        const flow = new FlowBuilder()
            .app({ id: "p258BindApp", root: "p258BindApp" })
            .node("ui-store", { id: "p258Store", statePath: "form", initialValue: JSON.stringify({ name: "Alice" }) })
            .node("ui-input", {
                id: "p258Bind",
                label: "Name",
                value: { kind: "store", path: "p258Store", subPath: { kind: "literal", value: "name" } },
                writeTo: { kind: "store", path: "p258Store", subPath: { kind: "literal", value: "name" } },
                writeTrigger: "change"
            })
            .node("ui-text", {
                id: "p258Mirror",
                value: { kind: "store", path: "p258Store", subPath: { kind: "literal", value: "name" } }
            })
            .node("ui-action", { id: "p258BindAct", actionType: "reset", target: "p258Bind" })
            .withInjectNode("p258BindInj", "p258BindAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258BindApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Bind"] sl-input');
        await expect(control).toHaveJSProperty("value", "Alice");
        await expect(webapp.root().locator(".webapp-text")).toContainText("Alice");

        // Change the value → writes through to the store (writeTrigger=change).
        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Bind"] sl-input') as HTMLElement & { value: string };
            el.value = "Bob";
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        // The store (and the mirror view) now hold the scratch value.
        await expect(webapp.root().locator(".webapp-text")).toContainText("Bob", { timeout: 5000 });

        await injectMessage(request, "p258BindInj");

        // reset → control returns to the STORE INITIAL "Alice" AND the store re-syncs
        // (the mirror view goes back to "Alice"), proving the bound path fires change.
        await expect(control).toHaveJSProperty("value", "Alice", { timeout: 5000 });
        await expect(webapp.root().locator(".webapp-text")).toContainText("Alice", { timeout: 5000 });
    });

    test("reset → an UNBOUND ui-textarea value returns to its rendered initial", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258TaApp", root: "p258TaApp" })
            .node("ui-textarea", { id: "p258Ta", label: "Notes", value: { kind: "literal", value: "start" } })
            .node("ui-action", { id: "p258TaAct", actionType: "reset", target: "p258Ta" })
            .withInjectNode("p258TaInj", "p258TaAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258TaApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Ta"] sl-textarea');
        await expect(control).toHaveJSProperty("value", "start");

        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Ta"] sl-textarea') as HTMLElement & { value: string };
            el.value = "scratch notes";
            el.dispatchEvent(new CustomEvent("sl-input", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("value", "scratch notes");

        await injectMessage(request, "p258TaInj");

        await expect(control).toHaveJSProperty("value", "start", { timeout: 5000 });
    });

    test("reset → a ui-checkbox returns to its initial checked state", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258CbApp", root: "p258CbApp" })
            .node("ui-checkbox", { id: "p258Cb", label: "Agree", value: { kind: "literal", value: false } })
            .node("ui-action", { id: "p258CbAct", actionType: "reset", target: "p258Cb" })
            .withInjectNode("p258CbInj", "p258CbAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258CbApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Cb"] sl-checkbox');
        await expect(control).toHaveJSProperty("checked", false);

        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Cb"] sl-checkbox') as HTMLElement & { checked: boolean };
            el.checked = true;
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("checked", true);

        await injectMessage(request, "p258CbInj");

        await expect(control).toHaveJSProperty("checked", false, { timeout: 5000 });
    });

    test("reset → a ui-switch returns to its initial checked state", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258SwApp", root: "p258SwApp" })
            .node("ui-switch", { id: "p258Sw", label: "On", value: { kind: "literal", value: false } })
            .node("ui-action", { id: "p258SwAct", actionType: "reset", target: "p258Sw" })
            .withInjectNode("p258SwInj", "p258SwAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258SwApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Sw"] sl-switch');
        await expect(control).toHaveJSProperty("checked", false);

        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Sw"] sl-switch') as HTMLElement & { checked: boolean };
            el.checked = true;
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("checked", true);

        await injectMessage(request, "p258SwInj");

        await expect(control).toHaveJSProperty("checked", false, { timeout: 5000 });
    });

    test("reset → a ui-select returns to its initial value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258SelApp", root: "p258SelApp" })
            .node("ui-select", {
                id: "p258Sel",
                label: "Pick",
                options: { kind: "literal", value: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
                value: { kind: "literal", value: "a" }
            })
            .node("ui-action", { id: "p258SelAct", actionType: "reset", target: "p258Sel" })
            .withInjectNode("p258SelInj", "p258SelAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258SelApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Sel"] sl-select');
        await expect(control).toHaveJSProperty("value", "a");

        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Sel"] sl-select') as HTMLElement & { value: string };
            el.value = "b";
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("value", "b");

        await injectMessage(request, "p258SelInj");

        await expect(control).toHaveJSProperty("value", "a", { timeout: 5000 });
    });

    test("reset → a ui-radio group returns to its initial value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258RaApp", root: "p258RaApp" })
            .node("ui-radio", {
                id: "p258Ra",
                label: "Choose",
                options: { kind: "literal", value: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
                value: { kind: "literal", value: "a" }
            })
            .node("ui-action", { id: "p258RaAct", actionType: "reset", target: "p258Ra" })
            .withInjectNode("p258RaInj", "p258RaAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258RaApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Ra"] sl-radio-group');
        await expect(control).toHaveJSProperty("value", "a");

        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Ra"] sl-radio-group') as HTMLElement & { value: string };
            el.value = "b";
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("value", "b");

        await injectMessage(request, "p258RaInj");

        await expect(control).toHaveJSProperty("value", "a", { timeout: 5000 });
    });

    test("reset → a ui-slider returns to its initial value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258SlApp", root: "p258SlApp" })
            .node("ui-slider", { id: "p258Sl", label: "Level", min: 0, max: 100, step: 1, value: { kind: "literal", value: 10 } })
            .node("ui-action", { id: "p258SlAct", actionType: "reset", target: "p258Sl" })
            .withInjectNode("p258SlInj", "p258SlAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258SlApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Sl"] sl-range');
        await expect(control).toHaveJSProperty("value", 10);

        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Sl"] sl-range') as HTMLElement & { value: number };
            el.value = 75;
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("value", 75);

        await injectMessage(request, "p258SlInj");

        await expect(control).toHaveJSProperty("value", 10, { timeout: 5000 });
    });

    test("reset → a ui-datepicker returns to its initial value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p258DpApp", root: "p258DpApp" })
            .node("ui-datepicker", { id: "p258Dp", label: "When", value: { kind: "literal", value: "2026-01-01" } })
            .node("ui-action", { id: "p258DpAct", actionType: "reset", target: "p258Dp" })
            .withInjectNode("p258DpInj", "p258DpAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258DpApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p258Dp"] sl-input');
        await expect(control).toHaveJSProperty("value", "2026-01-01");

        await page.evaluate(() => {
            const el = document.querySelector('[data-webapp-node="p258Dp"] sl-input') as HTMLElement & { value: string };
            el.value = "2026-12-31";
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });
        await expect(control).toHaveJSProperty("value", "2026-12-31");

        await injectMessage(request, "p258DpInj");

        await expect(control).toHaveJSProperty("value", "2026-01-01", { timeout: 5000 });
    });

    test("reset → a NON-form target (ui-text display) is a documented no-op and does not crash", async ({ page, request }) => {
        // A display node does not own `reset` (INTERACTION_VERBS_BY_TYPE), so no
        // command is pushed — the verb is inert. We prove it does not crash and does
        // not touch an UNRELATED control's scratch value.
        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(String(e)));

        const flow = new FlowBuilder()
            .app({ id: "p258NopApp", root: "p258NopApp" })
            .node("ui-text", { id: "p258Nop", text: "Static label" })
            .node("ui-input", { id: "p258NopIn", label: "Name" })
            .node("ui-action", { id: "p258NopAct", actionType: "reset", target: "p258Nop" })
            .withInjectNode("p258NopInj", "p258NopAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p258NopApp");
        await webapp.navigate("/");

        const input = page.locator('[data-webapp-node="p258NopIn"] sl-input');
        await input.click();
        await page.keyboard.type("keepme");
        await expect(input).toHaveJSProperty("value", "keepme");

        await injectMessage(request, "p258NopInj");
        await page.waitForTimeout(1000);

        // No-op: no client crash, and the unrelated control keeps its scratch value
        // (reset on a non-form target touches nothing).
        await expect(input).toHaveJSProperty("value", "keepme");
        expect(pageErrors).toEqual([]);
    });
});
