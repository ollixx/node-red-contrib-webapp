import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P272 (ADR 0042 §3) — the SHARED editor-common strings run through the
 * `webapp-common` catalog namespace, measured at two nodes of different
 * categories in BOTH languages.
 *
 * Mechanic (measured): editor-common.js has no node set of its own (it is a
 * statically served resource), so its strings resolve via
 * `RED._("node-red-contrib-webapp/webapp-common:common.<key>")` — the
 * namespace of the dedicated catalog-carrier set `webapp-common`
 * (nodes/webapp-common.js registers no types; @node-red/registry still
 * registers `nodes/locales/<lang>/webapp-common.json` under the set id, and
 * the editor loads it with all other node catalogs via /nodes/messages).
 * Resolution happens lazily at oneditprepare/dialog-open time with the en-US
 * literal as fallback.
 *
 * Measured sites:
 *   - ui-menu (navigation category): the injected base-field group — heading,
 *     row labels (shared strings from installBaseFields);
 *   - ui-icon (display category): the "Choose icon…" picker button
 *     (installIconField) plus its base-field heading;
 *   - ui-divider (pilot): the per-node N/A hint resolved from the node's OWN
 *     catalog via BASE_FIELDS.i18nNode (`ui-divider.hints.disabled`).
 */

type Lang = "en-US" | "de";

const SHARED = {
    "en-US": {
        heading: "General",
        visible: "Visible",
        disabled: "Disabled",
        color: "Color",
        advanced: "Advanced",
        chooseIcon: "Choose icon…",
        dividerDisabledHint: "A divider has no interactive state."
    },
    de: {
        heading: "Allgemein",
        visible: "Sichtbar",
        disabled: "Deaktiviert",
        color: "Farbe",
        advanced: "Erweitert",
        chooseIcon: "Icon wählen…",
        dividerDisabledHint: "Ein Trenner hat keinen interaktiven Zustand."
    }
} as const;

test.describe("shared editor-common strings i18n (P272)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function openPanel(
        page: import("@playwright/test").Page,
        request: import("@playwright/test").APIRequestContext,
        lang: Lang,
        nodeType: string,
        nodeId: string
    ) {
        await page.addInitScript((l) => localStorage.setItem("editor-language", l), lang);
        const flow = new FlowBuilder()
            .app({ id: "shApp", root: "shApp", name: "Shared Strings App" })
            .node(nodeType, { id: nodeId })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);
        return editor;
    }

    for (const lang of ["en-US", "de"] as const) {
        const t = SHARED[lang];

        test(`ui-menu base-field group renders the ${lang} shared strings`, async ({ page, request }) => {
            await openPanel(page, request, lang, "ui-menu", "menu-i18n");

            await expect(page.locator('[data-group-heading="base-fields"]')).toHaveText(t.heading);
            const labelOf = (field: string, input: string) =>
                page.locator(`[data-base-field="${field}"] label[for="node-input-${input}"]`);
            await expect(labelOf("visible", "visibleBinding")).toHaveText(t.visible);
            await expect(labelOf("disabled", "disabledBinding")).toHaveText(t.disabled);
            await expect(labelOf("color", "colorBinding")).toHaveText(t.color);
            await expect(page.locator("[data-base-advanced-toggle] a")).toContainText(t.advanced);
        });

        test(`ui-icon picker button renders the ${lang} shared string`, async ({ page, request }) => {
            await openPanel(page, request, lang, "ui-icon", "icon-i18n");

            await expect(page.locator(".webapp-icon-field-button")).toHaveText(t.chooseIcon);
            // The base-field heading proves the shared namespace at a second
            // site inside the same panel.
            await expect(page.locator('[data-group-heading="base-fields"]')).toHaveText(t.heading);
        });

        test(`ui-divider N/A hint resolves from the node's OWN catalog (${lang}, i18nNode)`, async ({ page, request }) => {
            await openPanel(page, request, lang, "ui-divider", "divider-hint-i18n");

            const row = page.locator('[data-base-field="disabled"]');
            await expect(row).toHaveAttribute("data-base-field-na", "true");
            await expect(row.locator("[data-base-field-hint]")).toHaveText(t.dividerDisabledHint);
            await expect(row).toHaveAttribute("title", t.dividerDisabledHint);
        });
    }
});
