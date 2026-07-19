import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P53 (ADR 0005) — the full ui-action interaction verb set, end to end.
 *
 * P226 (ADR 0037): the VISIBILITY / ENABLED verbs (show/hide/enable/disable) are
 * dynamic-state WRITERS — they set the target's ONE `visible`/`disabled` value on
 * the server (setDynamicStateField; unbound → per-client slot), and the value
 * drives the next snapshot re-render. There is no `.webapp-hidden` overlay layer:
 * a hidden element is simply absent from the snapshot, and the per-client value
 * survives later ui-store snapshot pushes (server-side truth). The disclosure /
 * selection verbs (open/close/select) still travel over the SSE `command` channel.
 *
 * Pattern: deploy a target element + a ui-action(verb, target) wired to an
 * inject node; navigate; fire the inject; assert the DOM reflects the verb.
 */

test.describe("ui-action interaction verbs (P53)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── show / hide (element presence) ──────────────────────────────────────

    test("hide → target element disappears; show → it reappears", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "verbApp1", root: "verbApp1" })
            .node("ui-text", { id: "verbTarget1", text: "Toggle me" })
            .node("ui-action", { id: "verbHide1", actionType: "hide", target: "verbTarget1" })
            .node("ui-action", { id: "verbShow1", actionType: "show", target: "verbTarget1" })
            .withInjectNode("verbHideInj1", "verbHide1")
            .build();
        // A second inject for `show`.
        flow.push({
            type: "inject", id: "verbShowInj1", name: "verbShowInj1",
            props: [{ p: "payload" }], repeat: "", crontab: "", once: false, onceDelay: "0.1",
            topic: "", payload: "", payloadType: "date",
            z: "e2e-flow", x: 100, y: 460, wires: [["verbShow1"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "verbApp1");
        await webapp.navigate("/");

        const target = page.locator('[data-webapp-node="verbTarget1"]');
        await expect(target).toBeVisible();

        // hide
        await injectMessage(request, "verbHideInj1");
        await expect(target).toBeHidden({ timeout: 5000 });

        // show again
        await injectMessage(request, "verbShowInj1");
        await expect(target).toBeVisible({ timeout: 5000 });
    });

    // ─── enable / disable ────────────────────────────────────────────────────

    test("disable → target control gets [disabled]; enable → it loses it", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "verbApp2", root: "verbApp2" })
            .node("ui-button", { id: "verbBtn2", label: "Click" })
            .node("ui-action", { id: "verbDisable2", actionType: "disable", target: "verbBtn2" })
            .node("ui-action", { id: "verbEnable2", actionType: "enable", target: "verbBtn2" })
            .withInjectNode("verbDisableInj2", "verbDisable2")
            .build();
        flow.push({
            type: "inject", id: "verbEnableInj2", name: "verbEnableInj2",
            props: [{ p: "payload" }], repeat: "", crontab: "", once: false, onceDelay: "0.1",
            topic: "", payload: "", payloadType: "date",
            z: "e2e-flow", x: 100, y: 460, wires: [["verbEnable2"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "verbApp2");
        await webapp.navigate("/");

        const button = page.locator('[data-webapp-node="verbBtn2"] sl-button');
        await expect(button).toBeVisible();
        await expect(button).not.toHaveAttribute("disabled", /.*/);

        await injectMessage(request, "verbDisableInj2");
        await expect(button).toHaveAttribute("disabled", "", { timeout: 5000 });

        await injectMessage(request, "verbEnableInj2");
        await expect(button).not.toHaveAttribute("disabled", /.*/, { timeout: 5000 });
    });

    // ─── open / close — dialog (the former openDialog behaviour, kept) ───────

    test("open(dialog) → dialog appears; close → it hides", async ({ page, request }) => {
        const dialogId = "verbDlg3";
        const baseFlow = new FlowBuilder()
            .app({ id: "verbApp3", root: "verbApp3" })
            .node("ui-text", { id: "verbTxt3", text: "Main" })
            .node("ui-store", { id: "verbStore3", statePath: `ui.dialogs.${dialogId}`, initialValue: `{"open":false}` })
            .node("ui-action", { id: "verbOpen3", actionType: "open", target: dialogId })
            .build();

        const fullFlow = [
            ...baseFlow,
            {
                type: "ui-dialog", id: dialogId, uiId: dialogId, name: "Verb Dialog",
                parent: "verbApp3", title: "Verb Dialog", layoutId: "vertical",
                z: "e2e-flow", x: 100, y: 300, wires: [[]]
            },
            {
                type: "ui-text", id: "verbDlgTxt3", uiId: "verbDlgTxt3", name: "verbDlgTxt3",
                parent: "verbApp3", mount: `dialog:${dialogId}/content`, text: "Dialog content",
                z: "e2e-flow", x: 100, y: 350, wires: [[]]
            },
            // open: inject → function(open=true) → store  AND  inject → ui-action(open)
            {
                type: "inject", id: "verbOpenInj3", name: "verbOpenInj3",
                props: [{ p: "payload" }], repeat: "", crontab: "", once: false, onceDelay: "0.1",
                topic: "", payload: "", payloadType: "date",
                z: "e2e-flow", x: 100, y: 500, wires: [["verbOpenFn3", "verbOpen3"]]
            },
            {
                type: "function", id: "verbOpenFn3", name: "verbOpenFn3",
                func: `msg.ui = { store: { id: "verbStore3", op: "set", path: "open", value: true } }; return msg;`,
                outputs: 1, z: "e2e-flow", x: 300, y: 500, wires: [["verbStore3"]]
            },
            // close: inject → function(open=false) → store
            {
                type: "inject", id: "verbCloseInj3", name: "verbCloseInj3",
                props: [{ p: "payload" }], repeat: "", crontab: "", once: false, onceDelay: "0.1",
                topic: "", payload: "", payloadType: "date",
                z: "e2e-flow", x: 100, y: 560, wires: [["verbCloseFn3"]]
            },
            {
                type: "function", id: "verbCloseFn3", name: "verbCloseFn3",
                func: `msg.ui = { store: { id: "verbStore3", op: "set", path: "open", value: false } }; return msg;`,
                outputs: 1, z: "e2e-flow", x: 300, y: 560, wires: [["verbStore3"]]
            }
        ];

        await deployFlow(request, fullFlow);

        const webapp = new WebappPage(page, "verbApp3");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-dialog")).not.toBeVisible();

        await injectMessage(request, "verbOpenInj3");
        await expect(page.locator(".webapp-dialog")).toBeVisible({ timeout: 5000 });
        await expect(page.locator(".webapp-dialog")).toContainText("Dialog content");

        await injectMessage(request, "verbCloseInj3");
        await expect(page.locator(".webapp-dialog")).not.toBeVisible({ timeout: 5000 });
    });

    // ─── open / close with target granularity (accordion section) ────────────

    test("open with target+part discloses that accordion section", async ({ page, request }) => {
        const items = JSON.stringify([
            { id: "secA", label: "Section A" },
            { id: "secB", label: "Section B" }
        ]);
        const flow = new FlowBuilder()
            .app({ id: "verbApp4", root: "verbApp4" })
            .node("ui-accordion", { id: "verbAcc4", sections: items })
            .node("ui-action", { id: "verbOpenSec4", actionType: "open", target: "verbAcc4", part: "secB" })
            .withInjectNode("verbOpenSecInj4", "verbOpenSec4")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "verbApp4");
        await webapp.navigate("/");

        const secA = page.locator('[data-webapp-node="verbAcc4"] sl-details[data-webapp-part="secA"]');
        const secB = page.locator('[data-webapp-node="verbAcc4"] sl-details[data-webapp-part="secB"]');
        await expect(secA).toBeVisible();
        await expect(secB).toBeVisible();
        // The FIRST section is open by default (ui-accordion resolves its open
        // section to the first child when none is bound — P169 / defaultOpenSectionId);
        // the second is closed. The `open` verb then discloses the targeted section.
        await expect(secA).toHaveAttribute("open", "");
        await expect(secB).not.toHaveAttribute("open", /.*/);

        await injectMessage(request, "verbOpenSecInj4");

        // The open verb discloses section B.
        await expect(secB).toHaveAttribute("open", "", { timeout: 5000 });
        // P247: the accordion is single-open by default (`multiple:false` — the
        // spec: "Im Einzel-Modus ist genau die openSection offen"). Disclosing B
        // therefore closes the previously-open section A — single-open applies to
        // programmatic ui-action disclosure exactly as it does to a user click.
        await expect(secA).not.toHaveAttribute("open", /.*/, { timeout: 5000 });
    });

    // ─── hidden value survives a ui-store-driven snapshot re-render ───────────

    test("a hide stays applied after a later ui-store snapshot push (value survives re-render)", async ({ page, request }) => {
        // Start with the target hidden via a hide action; then push a ui-store
        // update (which re-renders the whole grid). The element must STAY hidden —
        // P226 (ADR 0037): the hidden state is the target's per-client `visible`
        // VALUE (false), so every subsequent snapshot omits the element (no overlay
        // re-stamp needed).
        const flow = new FlowBuilder()
            .app({ id: "verbApp5", root: "verbApp5" })
            .node("ui-store", { id: "verbStore5", statePath: "greeting", initialValue: `"hello"` })
            .node("ui-text", { id: "verbBound5", value: { kind: "state", path: "greeting" } })
            .node("ui-text", { id: "verbHideMe5", text: "Hide me" })
            .node("ui-action", { id: "verbHide5", actionType: "hide", target: "verbHideMe5" })
            .withInjectNode("verbHideInj5", "verbHide5")
            .withStoreInject("verbStoreInj5", "verbStore5", "updated")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "verbApp5");
        await webapp.navigate("/");

        const hideMe = page.locator('[data-webapp-node="verbHideMe5"]');
        await expect(hideMe).toBeVisible();

        // Hide it via the action.
        await injectMessage(request, "verbHideInj5");
        await expect(hideMe).toBeHidden({ timeout: 5000 });

        // Now push a ui-store update → full snapshot re-render.
        await injectMessage(request, "verbStoreInj5");
        await expect(webapp.root()).toContainText("updated", { timeout: 5000 });

        // The element must STILL be hidden — the overlay survived the re-render.
        await expect(hideMe).toBeHidden();
    });
});
