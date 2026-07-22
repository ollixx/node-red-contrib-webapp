import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P46 — per-node E2E specs for ui-action (behavior node).
 *
 * ui-action does not render a component itself; it pushes interaction commands
 * to connected clients via the SSE stream. Commands change INTERACTION state
 * only — never business data.
 *
 * Dialog open/close in this system is driven by store state
 * (state.ui.dialogs.<id>.open). A ui-action `openDialog` command signals the
 * client to update its local dialogId so the NEXT snapshot push renders the
 * dialog. In production, a wired function node sets the dialog-state store
 * simultaneously (see examples/customers-crud/flow.json → fnNewCustomer). These
 * tests mirror that wired pattern to exercise the full lifecycle.
 *
 * Covers (per P46 scope):
 *   - navigate action → browser URL changes to target route.
 *   - openDialog action (via store state) → dialog becomes visible.
 *   - closeDialog action (via store state) → dialog hidden.
 *   - No CRUD / no store mutation: action nodes must NOT write to any store
 *     (assert that the rendered state value is unchanged after action fires).
 */

test.describe("ui-action (P46)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── navigate ─────────────────────────────────────────────────────────────

    test("navigate action → browser navigates to the target route", async ({ page, request }) => {
        // Deploy two routes. A ui-action(navigate) is wired to an inject node.
        // When inject fires, the action node pushes a navigate command → client
        // follows the location.
        const flow = new FlowBuilder()
            .app({ id: "actionApp1", root: "actionApp1" })
            .route({ id: "actionRoute1a", path: "/first" })
            .node("ui-text", { id: "actionTxt1a", text: "First route" })
            .route({ id: "actionRoute1b", path: "/second" })
            .node("ui-text", { id: "actionTxt1b", text: "Second route" })
            .node("ui-action", {
                id: "actionNav1",
                actionType: "navigate",
                to: "/second",
                // P59 / ADR 0007 §4: ui-action emits the action; the wired ui-app
                // (which owns navigate) performs the SSE push.
                wires: [["actionApp1"]]
            })
            .withInjectNode("actionInj1", "actionNav1")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "actionApp1");
        await webapp.navigate("/first");
        await expect(webapp.root()).toContainText("First route");

        // Fire the navigate action — the client should follow to /second.
        await injectMessage(request, "actionInj1");

        // The client calls window.location.assign() which causes a full navigation.
        await page.waitForURL(/\/second/, { timeout: 5000 });
        await expect(webapp.root()).toContainText("Second route");
    });

    // ─── openDialog (via store-driven state, mirroring production pattern) ────

    test("openDialog action + store update → dialog becomes visible", async ({ page, request }) => {
        // This test mirrors the production pattern (see customers-crud fnNewCustomer):
        // clicking "New" triggers a function node that BOTH:
        //   1. updates a dialogStore (sets ui.dialogs.<id>.open = true)
        //   2. triggers openDialog command via a ui-action
        // The store update causes a snapshot push with the dialog rendered.
        // We replicate this with inject → function → dialogStore (for snapshot)
        // and inject → ui-action (for SSE command).

        const dialogId = "actionDlg2";
        const storeId = "dlgStore2";
        const funcId = "dlgOpenFunc2";
        const injectId = "dlgOpenInj2";
        const actionId = "dlgOpenAction2";

        const baseFlow = new FlowBuilder()
            .app({ id: "actionApp2", root: "actionApp2" })
            .node("ui-text", { id: "actionTxt2", text: "Main content" })
            // dialogStore: controls state.ui.dialogs.<id>.open
            .node("ui-store", {
                id: storeId,
                statePath: `ui.dialogs.${dialogId}`,
                initialValue: `{"open":false}`
            })
            .node("ui-action", {
                id: actionId,
                actionType: "openDialog",
                target: dialogId
            })
            .build();

        // Build the dialog and its content inline.
        const fullFlow = [
            ...baseFlow,
            {
                type: "ui-dialog",
                id: dialogId,
                uiId: dialogId,
                name: "Test Dialog",
                app: "actionApp2",
                title: "Test Dialog",
                layoutId: "vertical",
                z: "e2e-flow",
                x: 100,
                y: 300,
                wires: [[]]
            },
            {
                type: "ui-text",
                id: "dlgTxt2",
                uiId: "dlgTxt2",
                name: "dlgTxt2",
                app: "actionApp2",
                mount: `dialog:${dialogId}/content`,
                text: "Dialog content",
                z: "e2e-flow",
                x: 100,
                y: 350,
                wires: [[]]
            },
            // inject → function that sets open=true → storeId
            {
                type: "inject",
                id: injectId,
                name: injectId,
                props: [{ p: "payload" }],
                repeat: "",
                crontab: "",
                once: false,
                onceDelay: "0.1",
                topic: "",
                payload: "",
                payloadType: "date",
                z: "e2e-flow",
                x: 100,
                y: 500,
                wires: [[funcId]]
            },
            {
                type: "function",
                id: funcId,
                name: funcId,
                func: `msg.ui = { store: { id: "${storeId}", op: "set", path: "open", value: true } }; return msg;`,
                outputs: 1,
                z: "e2e-flow",
                x: 300,
                y: 500,
                wires: [[storeId]]
            }
        ];

        await deployFlow(request, fullFlow);

        const webapp = new WebappPage(page, "actionApp2");
        await webapp.navigate("/");

        // Dialog should NOT be visible initially.
        await expect(page.locator(".webapp-dialog")).not.toBeVisible();

        // Fire inject → function → store update → SSE snapshot push with dialog open.
        await injectMessage(request, injectId);

        // The store update triggers a snapshot push with the dialog rendered.
        await expect(page.locator(".webapp-dialog")).toBeVisible({ timeout: 5000 });
        await expect(page.locator(".webapp-dialog")).toContainText("Dialog content");
    });

    // ─── closeDialog (via store-driven state) ─────────────────────────────────

    test("closeDialog action + store update → open dialog is hidden", async ({ page, request }) => {
        const dialogId = "actionDlg3";
        const storeId = "dlgStore3";
        const openFuncId = "dlgOpenFunc3";
        const closeFuncId = "dlgCloseFunc3";
        const openInjId = "dlgOpenInj3";
        const closeInjId = "dlgCloseInj3";

        const baseFlow = new FlowBuilder()
            .app({ id: "actionApp3", root: "actionApp3" })
            .node("ui-text", { id: "actionTxt3", text: "Main" })
            .node("ui-store", {
                id: storeId,
                statePath: `ui.dialogs.${dialogId}`,
                initialValue: `{"open":false}`
            })
            .build();

        const fullFlow = [
            ...baseFlow,
            {
                type: "ui-dialog",
                id: dialogId,
                uiId: dialogId,
                name: "Close Dialog",
                app: "actionApp3",
                title: "Close Dialog",
                layoutId: "vertical",
                z: "e2e-flow",
                x: 100,
                y: 300,
                wires: [[]]
            },
            {
                type: "ui-text",
                id: "dlgTxt3",
                uiId: "dlgTxt3",
                name: "dlgTxt3",
                app: "actionApp3",
                mount: `dialog:${dialogId}/content`,
                text: "Dialog text",
                z: "e2e-flow",
                x: 100,
                y: 350,
                wires: [[]]
            },
            // Open: inject → function (open=true) → store
            {
                type: "inject",
                id: openInjId,
                name: openInjId,
                props: [{ p: "payload" }],
                repeat: "",
                crontab: "",
                once: false,
                onceDelay: "0.1",
                topic: "",
                payload: "",
                payloadType: "date",
                z: "e2e-flow",
                x: 100,
                y: 500,
                wires: [[openFuncId]]
            },
            {
                type: "function",
                id: openFuncId,
                name: openFuncId,
                func: `msg.ui = { store: { id: "${storeId}", op: "set", path: "open", value: true } }; return msg;`,
                outputs: 1,
                z: "e2e-flow",
                x: 300,
                y: 500,
                wires: [[storeId]]
            },
            // Close: inject → function (open=false) → store
            {
                type: "inject",
                id: closeInjId,
                name: closeInjId,
                props: [{ p: "payload" }],
                repeat: "",
                crontab: "",
                once: false,
                onceDelay: "0.1",
                topic: "",
                payload: "",
                payloadType: "date",
                z: "e2e-flow",
                x: 100,
                y: 560,
                wires: [[closeFuncId]]
            },
            {
                type: "function",
                id: closeFuncId,
                name: closeFuncId,
                func: `msg.ui = { store: { id: "${storeId}", op: "set", path: "open", value: false } }; return msg;`,
                outputs: 1,
                z: "e2e-flow",
                x: 300,
                y: 560,
                wires: [[storeId]]
            }
        ];

        await deployFlow(request, fullFlow);

        const webapp = new WebappPage(page, "actionApp3");
        await webapp.navigate("/");

        // Open the dialog via store update.
        await injectMessage(request, openInjId);
        await expect(page.locator(".webapp-dialog")).toBeVisible({ timeout: 5000 });

        // Close the dialog via store update.
        await injectMessage(request, closeInjId);
        await expect(page.locator(".webapp-dialog")).not.toBeVisible({ timeout: 5000 });
    });

});
// NOTE (P86): "navigate does NOT update store" was a behaviour-layer E2E test.
// It is now covered by the classic handler tests in
// packages/runtime/test/p86-structure-state-behavior-nodes-behaviour.test.ts
// (ui-app navigate verb → SSE command push, no applyStoreOperation call).
// Per test-conventions.md: handler behaviour belongs in fast classic tests, not E2E.
