import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P42 — per-node E2E specs for ui-dialog (structure node).
 *
 * The server renders a dialog when `?dialog=<id>` is present in the URL (it sets
 * `ui.dialogs.<id>.open = true` in the effective state for that render). This
 * allows purely server-driven dialog open/close tests without needing an inject
 * node pipeline.
 *
 * Covers the P42 scope:
 *   - Dialog not visible on initial page load (no dialog param).
 *   - ?dialog=<id> in URL → server renders dialog visible (.webapp-dialog in DOM).
 *   - Navigating away (removing ?dialog) → dialog not present.
 *   - Dialog with a child node renders that node inside the dialog.
 */

const TAB_ID = "e2e-flow";

/** Build a minimal flow with a ui-dialog attached to a ui-app. */
function buildDialogFlow(): NodeDef[] {
    const appId = "dialogApp";
    const dialogId = "testDialog";

    const tab: NodeDef = { id: TAB_ID, type: "tab", label: "E2E", disabled: false, info: "" };
    const app: NodeDef = {
        type: "ui-app", id: appId, uiId: appId, name: "Dialog App",
        title: "Dialog App", root: appId, layout: "vertical", z: TAB_ID, wires: [[]]
    };
    const route: NodeDef = {
        type: "ui-route", id: "dialogRoute", uiId: "dialogRoute", name: "Home",
        parent: appId, path: "/", title: "Home", layoutId: "vertical", z: TAB_ID, wires: [[]]
    };
    const dialog: NodeDef = {
        type: "ui-dialog", id: dialogId, uiId: dialogId, name: "Test Dialog",
        title: "Test Dialog", parent: appId, layoutId: "vertical", closable: true, z: TAB_ID, wires: [[]]
    };
    // A text node mounted inside the dialog to verify child rendering.
    const dialogText: NodeDef = {
        type: "ui-text", id: "dialogText", uiId: "dialogText", name: "dialog text",
        parent: appId, mount: `${dialogId}.content`, text: "Dialog content here",
        z: TAB_ID, wires: [[]]
    };

    return [tab, app, route, dialog, dialogText];
}

test.describe("ui-dialog (P42)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("dialog not visible on initial page load", async ({ page, request }) => {
        await deployFlow(request, buildDialogFlow());

        const webapp = new WebappPage(page, "dialogApp");
        await webapp.navigate("/");

        // No ?dialog param → no .webapp-dialog in the DOM.
        await expect(page.locator(".webapp-dialog")).not.toBeVisible();
    });

    test("?dialog=<id> — server renders dialog visible", async ({ page, request }) => {
        await deployFlow(request, buildDialogFlow());

        // The server renders the dialog open when ?dialog=<dialogId> is in the URL.
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/dialogApp/stream")
        );
        await page.goto("/webapp/dialogApp/?dialog=testDialog");
        await expect(page.locator("#webapp-client-root")).toBeVisible();
        await streamRequested;

        // The dialog overlay must be visible in the server-rendered HTML.
        await expect(page.locator(".webapp-dialog")).toBeVisible();
    });

    test("navigating without ?dialog — dialog not present", async ({ page, request }) => {
        await deployFlow(request, buildDialogFlow());

        // First navigate with the dialog open.
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/dialogApp/stream")
        );
        await page.goto("/webapp/dialogApp/?dialog=testDialog");
        await expect(page.locator("#webapp-client-root")).toBeVisible();
        await streamRequested;
        await expect(page.locator(".webapp-dialog")).toBeVisible();

        // Then navigate to the same app without the dialog param.
        const webapp = new WebappPage(page, "dialogApp");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-dialog")).not.toBeVisible();
    });

    test("dialog with child node — child renders inside .webapp-dialog", async ({ page, request }) => {
        await deployFlow(request, buildDialogFlow());

        // Open via server render so the child is included in the dialog's regions.
        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/dialogApp/stream")
        );
        await page.goto("/webapp/dialogApp/?dialog=testDialog");
        await expect(page.locator("#webapp-client-root")).toBeVisible();
        await streamRequested;
        await expect(page.locator(".webapp-dialog")).toBeVisible();

        // The child text node must appear inside the dialog overlay.
        const dialog = page.locator(".webapp-dialog");
        await expect(dialog).toContainText("Dialog content here");
    });

    // ── P64: native <sl-dialog> + closable ─────────────────────────────────────

    test("dialog renders as a native <sl-dialog> with the title as its label", async ({ page, request }) => {
        await deployFlow(request, buildDialogFlow());

        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/dialogApp/stream")
        );
        await page.goto("/webapp/dialogApp/?dialog=testDialog");
        await expect(page.locator("#webapp-client-root")).toBeVisible();
        await streamRequested;

        const dialog = page.locator("sl-dialog.webapp-dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveJSProperty("tagName", "SL-DIALOG");
        await expect(dialog).toHaveAttribute("label", "Test Dialog");
        // closable (default) → no `no-header` attribute.
        await expect(dialog).not.toHaveAttribute("no-header", /.*/);
    });

    test("closable:false → native no-header (no X / title)", async ({ page, request }) => {
        const flow = buildDialogFlow();
        const dialogNode = flow.find((n) => n.type === "ui-dialog");
        if (dialogNode) {
            dialogNode.closable = false;
        }
        await deployFlow(request, flow);

        const streamRequested = page.waitForRequest((req) =>
            req.url().includes("/webapp/dialogApp/stream")
        );
        await page.goto("/webapp/dialogApp/?dialog=testDialog");
        await expect(page.locator("#webapp-client-root")).toBeVisible();
        await streamRequested;

        const dialog = page.locator("sl-dialog.webapp-dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute("no-header", /.*/);
    });
});
