import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P256 — MEASURE the three previously-unproven ui-action verbs against the real
 * DOM: `focus`, `select`, `reset`. Each test deploys a target element + a
 * ui-action(verb, target) wired to an inject node, navigates, fires the inject,
 * and asserts the concrete DOM effect the verb must produce.
 */

test.describe("ui-action verbs focus / select / reset (P256)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── focus → the target input control receives focus ─────────────────────

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

    // ─── select → the target tab becomes active ──────────────────────────────

    test("select(part) → the targeted ui-tabs tab becomes active", async ({ page, request }) => {
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

        // The select verb activates the targeted tab.
        await expect(de).toHaveAttribute("active", "", { timeout: 5000 });
    });

    // ─── reset → the target input returns to its initial (empty) value ───────

    test("reset → the target ui-input value returns to its initial state", async ({ page, request }) => {
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

        // The reset verb clears the field back to its initial (empty) value.
        await expect(control).toHaveJSProperty("value", "", { timeout: 5000 });
    });
});
