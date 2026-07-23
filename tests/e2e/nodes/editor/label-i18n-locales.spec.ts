import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P272 (ADR 0042 §3) — editor-LABEL i18n, PROVEN on the pilot node `ui-divider`.
 *
 * Mechanic (measured against node-red 4.0.5):
 *   - Message catalogs live at `nodes/<cat>/locales/<lang>/<node>.json`, next to
 *     the registered `.js` (`@node-red/registry/lib/loader.js` → loadNodeLocales:
 *     when `path.dirname(node.file) + /locales` exists, the catalog file
 *     `<basename>.json` is registered under the node SET id as its i18n
 *     namespace — `node-red-contrib-webapp/ui-divider`).
 *   - In the edit template, form-row labels carry `data-i18n="<node>.label.<field>"`.
 *     When the edit tray opens, `RED.editor.buildEditForm` prefixes every
 *     un-namespaced `data-i18n` key with the node set's id
 *     (`node._def.set.id + ":"`), then `trayBody.i18n()` (jquery-i18next)
 *     replaces the element text with the catalog translation.
 *   - The editor loads ALL node catalogs at startup via
 *     `GET /nodes/messages?lng=<lang>` for `localStorage["editor-language"]`
 *     plus the i18next fallback chain (en-US) — so switching the editor
 *     language (the same `editor-language` key the P265 help pilot proved)
 *     switches the labels, and unknown languages fall back to en-US.
 *   - Select `<option>` texts and `[placeholder]`-prefixed keys are translated
 *     by the same pass.
 *
 * This spec measures it in the real editor: English labels under en-US
 * (default), German labels under `de`, fallback to en-US for an unknown
 * language — including option texts and the placeholder.
 */

test.describe("ui-divider editor-label i18n (P272 pilot)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openDividerPanel(
        page: import("@playwright/test").Page,
        request: import("@playwright/test").APIRequestContext
    ) {
        const nodeId = "divider-i18n";
        const flow = new FlowBuilder()
            .app({ id: "liApp", root: "liApp", name: "Label I18n App" })
            .node("ui-divider", { id: nodeId })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);
        return { editor, nodeId };
    }

    function labelFor(page: import("@playwright/test").Page, field: string) {
        return page.locator(`.red-ui-tray label[for="node-input-${field}"]`);
    }

    test("default editor language (en-US) renders the ENGLISH labels, options and placeholder", async ({ page, request }) => {
        await openDividerPanel(page, request);

        await expect(labelFor(page, "mount")).toHaveText("Parent Slot");
        await expect(labelFor(page, "orientation")).toHaveText("Orientation");
        await expect(labelFor(page, "label")).toHaveText("Label");
        // `Name` goes through Node-RED's own common catalog (node-red:common.label.name).
        await expect(labelFor(page, "name")).toHaveText("Name");

        // Option texts are translated by the same data-i18n pass.
        await expect(
            page.locator('#node-input-orientation option[value="vertical"]')
        ).toHaveText("Vertical");

        // The [placeholder] attribute key.
        await expect(page.locator("#node-input-label")).toHaveAttribute(
            "placeholder",
            "optional divider label"
        );
    });

    test("editor language de renders the GERMAN labels, options and placeholder", async ({ page, request }) => {
        // The exact mechanism of the editor's language setting (proven by P265):
        // the User Settings language dropdown persists localStorage["editor-language"],
        // which drives both the /nodes/messages catalog requests and i18next's lng.
        await page.addInitScript(() => localStorage.setItem("editor-language", "de"));
        await openDividerPanel(page, request);

        await expect(labelFor(page, "mount")).toHaveText("Parent-Slot");
        await expect(labelFor(page, "orientation")).toHaveText("Ausrichtung");
        await expect(labelFor(page, "label")).toHaveText("Beschriftung");
        // Node-RED's own de catalog translates common.label.name → "Name".
        await expect(labelFor(page, "name")).toHaveText("Name");

        await expect(
            page.locator('#node-input-orientation option[value="vertical"]')
        ).toHaveText("Vertikal");

        await expect(page.locator("#node-input-label")).toHaveAttribute(
            "placeholder",
            "optionale Trenner-Beschriftung"
        );
    });

    test("unknown editor language falls back to the en-US labels", async ({ page, request }) => {
        await page.addInitScript(() => localStorage.setItem("editor-language", "fr"));
        await openDividerPanel(page, request);

        await expect(labelFor(page, "orientation")).toHaveText("Orientation");
        await expect(labelFor(page, "mount")).toHaveText("Parent Slot");
    });
});
