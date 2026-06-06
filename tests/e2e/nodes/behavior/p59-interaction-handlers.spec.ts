import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P59 (ADR 0007 §2/§3) — per-node interaction handlers.
 *
 * The SSE push moved out of ui-action and into the target node. Two end-to-end
 * properties this phase guarantees:
 *
 *  1. Wiring is the addressing: ui-button → ui-action(open) → ui-dialog. The
 *     dialog's own handler performs the push when the action message arrives over
 *     the wire — the existing open-dialog behaviour stays green.
 *  2. Democratised interaction: a PLAIN inject (NO ui-action) carrying
 *     { ui: { action: { type: "navigate", to: "/" } } } wired to ui-app makes the
 *     client navigate. ui-action holds no special runtime privilege.
 */

const TAB_ID = "e2e-flow";

test.describe("P59: per-node interaction handlers (ADR 0007)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-button → ui-action(open) → ui-dialog wired opens the dialog", async ({ page, request }) => {
        const appId = "p59App1";
        const dialogId = "p59Dialog1";
        const buttonId = "p59Btn1";
        const actionId = "p59Open1";

        const base = new FlowBuilder()
            .app({ id: appId, root: appId })
            .node("ui-text", { id: "p59Txt1", text: "Main content" })
            // The button click is wired to the ui-action; the ui-action(open) is
            // wired to the dialog, which performs the push (ADR 0007 §2).
            .node("ui-button", { id: buttonId, label: "Open dialog", wires: [[actionId]] })
            .node("ui-action", { id: actionId, actionType: "open", wires: [[dialogId]] })
            .build();

        const fullFlow: NodeDef[] = [
            ...base,
            {
                type: "ui-dialog", id: dialogId, uiId: dialogId, name: "P59 Dialog",
                parent: appId, title: "P59 Dialog", layoutId: "vertical",
                z: TAB_ID, x: 100, y: 300, wires: [[]]
            },
            {
                type: "ui-text", id: "p59DlgTxt1", uiId: "p59DlgTxt1", name: "p59DlgTxt1",
                parent: appId, mount: `dialog:${dialogId}/content`, text: "Dialog body",
                z: TAB_ID, x: 100, y: 350, wires: [[]]
            }
        ];

        await deployFlow(request, fullFlow);

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/");
        await expect(page.locator(".webapp-dialog")).not.toBeVisible();

        // Click the button → click event → ui-action(open) → ui-dialog pushes open.
        await page.locator(`[data-webapp-node="${buttonId}"] sl-button`).click();

        await expect(page.locator(".webapp-dialog")).toBeVisible({ timeout: 5000 });
        await expect(page.locator(".webapp-dialog")).toContainText("Dialog body");
    });

    test("a bare inject (NO ui-action) with a navigate action wired to ui-app navigates the client", async ({ page, request }) => {
        const appId = "p59App2";

        const base = new FlowBuilder()
            .app({ id: appId, root: appId })
            .node("ui-text", { id: "p59Home2", text: "Home page" })
            .route({ id: "p59Route2", path: "/elsewhere" })
            .node("ui-text", { id: "p59Else2", text: "Elsewhere page" })
            .build();

        // A PLAIN inject node emitting the action contract, wired straight to the
        // ui-app — no ui-action involved (ADR 0007 §1 + §4).
        const injectId = "p59Inj2";
        const fullFlow: NodeDef[] = [
            ...base,
            {
                type: "inject", id: injectId, name: injectId,
                props: [{ p: "payload" }],
                repeat: "", crontab: "", once: false, onceDelay: "0.1",
                topic: "",
                payload: JSON.stringify({ ui: { action: { type: "navigate", to: "/elsewhere" } } }),
                payloadType: "json",
                z: TAB_ID, x: 100, y: 500, wires: [["p59Fn2"]]
            },
            // A function node lifts msg.payload into the message body so msg.ui.action
            // is set (inject's JSON payload otherwise lands in msg.payload).
            {
                type: "function", id: "p59Fn2", name: "p59Fn2",
                func: "msg.ui = msg.payload.ui; return msg;",
                outputs: 1, z: TAB_ID, x: 300, y: 500, wires: [[appId]]
            }
        ];

        await deployFlow(request, fullFlow);

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/");
        await expect(webapp.root()).toContainText("Home page");

        // Fire the inject → function → ui-app(navigate). The app owns navigate and
        // pushes the command; the client follows.
        await injectMessage(request, injectId);

        await page.waitForURL(/\/elsewhere/, { timeout: 5000 });
        await expect(webapp.root()).toContainText("Elsewhere page");
    });
});
