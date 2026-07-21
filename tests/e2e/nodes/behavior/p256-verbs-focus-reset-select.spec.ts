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
 *   • select → INERT for the canonical tab/stepper/menu targets. The verb IS
 *              pushed as a client `command`, but the client's `findPartElement`
 *              resolves the part via `[name="<part>"]`, which for a ui-tabs
 *              matches the `sl-tab-panel[name]` BODY, not the `sl-tab[panel]`
 *              NAV element — clicking the panel body never activates the tab.
 *              Unlike accordion `sl-details` (which carry `data-webapp-part`),
 *              tab/stepper/menu items expose no such hook. Making select real
 *              across tabs/stepper/menu/table is a cross-node serializer +
 *              client change with per-node activation semantics → FLAGGED for an
 *              owner decision (implement vs. remove the verb). See the fixme
 *              measurement below.
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

    // ─── select → the target tab becomes active (MEASURED INERT — FLAGGED) ────
    //
    // fixme: kept as an executable record of what `select` SHOULD do. It fails
    // today (the client clicks the sl-tab-panel body, not the sl-tab nav), and is
    // parked pending the owner decision (implement across tabs/stepper/menu/table
    // vs. remove the verb). Do NOT delete without resolving the flag.
    test.fixme("select(part) → the targeted ui-tabs tab becomes active", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "p256SelApp", root: "p256SelApp" })
            .node("ui-tabs", { id: "p256Tabs" })
            .node("ui-tab", { id: "p256TabOv", mount: "ui-tabs:p256Tabs/content", label: { kind: "literal", value: "Overview" }, order: 0 })
            .node("ui-tab", { id: "p256TabDe", mount: "ui-tabs:p256Tabs/content", label: { kind: "literal", value: "Details" }, order: 1 })
            .node("ui-text", { id: "p256TabOvBody", mount: "ui-tab:p256TabOv/content", text: "Overview body" })
            .node("ui-text", { id: "p256TabDeBody", mount: "ui-tab:p256TabDe/content", text: "Details body" })
            .node("ui-action", { id: "p256SelAct", actionType: "select", target: "p256Tabs", part: "p256TabDe" })
            .withInjectNode("p256SelInj", "p256SelAct");
        const flow = builder.build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "p256SelApp");
        await webapp.navigate("/");

        const ov = page.locator("sl-tab[panel='p256TabOv']");
        const de = page.locator("sl-tab[panel='p256TabDe']");
        await expect(ov).toBeVisible();
        // Default: first tab active.
        await expect(ov).toHaveAttribute("active", "");
        await expect(de).not.toHaveAttribute("active", /.*/);

        await injectMessage(request, "p256SelInj");

        // The select verb should activate the targeted tab.
        await expect(de).toHaveAttribute("active", "", { timeout: 5000 });
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
