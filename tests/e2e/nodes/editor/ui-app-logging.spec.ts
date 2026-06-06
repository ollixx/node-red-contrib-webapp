import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P61 — Editor-UX: Logging select + info-icon dialog for ui-app.
 *
 * These tests drive the Node-RED editor to verify that:
 * 1. The ui-app panel shows a single 'Logging' select (not a checkbox + tips
 *    block + separate 'Min. Stufe' row).
 * 2. An info-icon button is present next to the Logging label and opens a
 *    jQuery-UI dialog that can be closed.
 * 3. Round-trip: 'aus' saves forwardErrorsToClient=false; 'warn' saves
 *    forwardErrorsToClient=true + forwardErrorMinSeverity=warn.
 * 4. Migration: an existing node with forwardErrorsToClient=true + minSeverity=info
 *    loads as select value 'info'.
 *
 * NOTE: E2E was authored for P61 but NOT run in the worktree (the worktree
 * lacks the owner-only .node-red-dev/settings.js required by the webServer
 * config). The orchestrator will run the full Playwright suite in the main
 * checkout.
 */

test.describe("ui-app Logging select (P61)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("P61 — Logging select is present; no permanent tips block; no Min. Stufe row", async ({ page, request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "logApp1", root: "logApp1" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("logApp1");

        // 1. The Logging select must be present.
        await expect(page.locator("#node-ui-app-logging")).toBeVisible();

        // 2. The info-icon button must be present.
        await expect(page.locator("#node-ui-app-logging-info-btn")).toBeVisible();

        // 3. No permanent .form-tips block visible (the old tips block is gone).
        //    (form-tips blocks inside a node tray panel are still in the DOM if
        //    other nodes use them, so we narrow to the tray and check that no
        //    .form-tips containing the old error-forwarding text is visible.)
        const tray = page.locator(".red-ui-tray").last();
        await expect(tray.locator(".form-tips")).toHaveCount(0);

        // 4. No separate 'Min. Stufe' row (the old conditional row is gone).
        await expect(page.locator("#node-ui-app-min-severity-row")).toHaveCount(0);

        // 5. The forwardErrorsToClient checkbox must NOT be visible (it's hidden).
        await expect(page.locator("#node-input-forwardErrorsToClient")).not.toBeVisible();
    });

    test("P61 — info-icon button opens and closes the Logging info dialog", async ({ page, request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "logApp2", root: "logApp2" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("logApp2");

        // Click the info button — the jQuery-UI dialog should appear.
        await page.locator("#node-ui-app-logging-info-btn").click();
        await expect(page.locator("#node-dialog-logging-info")).toBeVisible();

        // Close via the dialog button.
        await page.locator(".ui-dialog-buttonset button").filter({ hasText: "Schließen" }).click();
        await expect(page.locator("#node-dialog-logging-info")).not.toBeVisible();
    });

    test("P61 — default select value is 'aus' for a fresh node (secure default)", async ({ page, request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "logApp3", root: "logApp3" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("logApp3");

        const val = await page.locator("#node-ui-app-logging").inputValue();
        expect(val).toBe("aus");
    });

    test("P61 — round-trip: 'aus' saves forwardErrorsToClient=false", async ({ page, request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "logApp4", root: "logApp4" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("logApp4");

        // Select 'aus' (should already be default, but set explicitly).
        await page.locator("#node-ui-app-logging").selectOption("aus");
        await editor.save();

        // Read the stored node value from Node-RED's registry.
        const stored = await page.evaluate(() => {
            const node = RED.nodes.node("logApp4") as { forwardErrorsToClient?: boolean } | null;
            return node ? node.forwardErrorsToClient : undefined;
        });
        expect(stored).toBe(false);
    });

    test("P61 — round-trip: 'warn' saves forwardErrorsToClient=true + minSeverity=warn", async ({ page, request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "logApp5", root: "logApp5" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("logApp5");

        await page.locator("#node-ui-app-logging").selectOption("warn");
        await editor.save();

        const stored = await page.evaluate(() => {
            const node = RED.nodes.node("logApp5") as {
                forwardErrorsToClient?: boolean;
                forwardErrorMinSeverity?: string;
            } | null;
            return node ? { forwardErrorsToClient: node.forwardErrorsToClient, forwardErrorMinSeverity: node.forwardErrorMinSeverity } : null;
        });
        expect(stored?.forwardErrorsToClient).toBe(true);
        expect(stored?.forwardErrorMinSeverity).toBe("warn");

        // Re-open and verify the select shows 'warn'.
        await editor.openNode("logApp5");
        const val = await page.locator("#node-ui-app-logging").inputValue();
        expect(val).toBe("warn");
    });

    test("P61 — migration: node with forwardErrorsToClient=true + minSeverity=info loads as 'info'", async ({ page, request }) => {
        // Deploy a node that has the OLD forwardErrorsToClient=true, minSeverity=info
        // config fields (as a legacy node would have stored them).
        const flow = [
            {
                type: "ui-app",
                id: "legacyApp",
                uiId: "legacyApp",
                name: "Legacy App",
                root: "legacyApp",
                layout: "vertical",
                layoutId: "vertical",
                events: "[]",
                outputs: 0,
                tokens: "",
                forwardErrorsToClient: true,
                forwardErrorMinSeverity: "info",
                z: "e2e-flow",
                x: 100,
                y: 100,
                wires: []
            }
        ];
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("legacyApp");

        // The select must show 'info' (migration from old boolean+severity pair).
        const val = await page.locator("#node-ui-app-logging").inputValue();
        expect(val).toBe("info");
    });
});
