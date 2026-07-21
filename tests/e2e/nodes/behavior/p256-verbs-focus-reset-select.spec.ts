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
 *   • reset  → INERT for its documented purpose. The verb IS pushed, but the
 *              client `reset` handler only clears the `open`/`selected`
 *              interaction-overlay flags for the target (empty for an input) and
 *              re-renders the snapshot — it never resets a field VALUE. A typed
 *              input keeps its value across reset. "Reset to initial value" has
 *              different meaning per owning target type (ui-input/ui-textarea/
 *              ui-datepicker vs. ui-app/ui-route) → FLAGGED for an owner
 *              decision. See the fixme measurement below.
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

    // ─── reset → the target input returns to its initial value (INERT — FLAGGED)
    //
    // fixme: kept as an executable record of what `reset` SHOULD do. It fails
    // today (the typed value survives — the client only clears open/selected
    // overlay flags), parked pending the owner decision. Do NOT delete without
    // resolving the flag.
    test.fixme("reset → the target ui-input value returns to its initial state", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p256ResetApp", root: "p256ResetApp" })
            .node("ui-input", { id: "p256ResetInput", label: { kind: "literal", value: "Name" } })
            .node("ui-action", { id: "p256ResetAct", actionType: "reset", target: "p256ResetInput" })
            .withInjectNode("p256ResetInj", "p256ResetAct")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p256ResetApp");
        await webapp.navigate("/");

        const control = page.locator('[data-webapp-node="p256ResetInput"] sl-input');
        await expect(control).toBeVisible();

        // Type a value into the field.
        await control.click();
        await page.keyboard.type("scratch");
        await expect(control).toHaveJSProperty("value", "scratch");

        await injectMessage(request, "p256ResetInj");

        // The reset verb should clear the field back to its initial (empty) value.
        await expect(control).toHaveJSProperty("value", "", { timeout: 5000 });
    });
});
