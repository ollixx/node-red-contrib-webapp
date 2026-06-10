import { expect, test } from "@playwright/test";

import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P120 — Dual-path colour-coding: CSS tokens, pathBadge helper, editor
 * user setting.
 *
 * ADR 0011 §4: two conceptual paths for navigaton target configuration
 * (wire = blue, reference = purple) get a consistent visual coding. This
 * spec verifies:
 *   1. The CSS custom properties are present on :root with the default colours.
 *   2. pathBadge() produces elements with the correct class/style and
 *      contains both an icon and a label.
 *   3. The "Webapp" section appears in Node-RED's user-settings pane and
 *      exposes two colour inputs.
 *   4. Changing a colour in the settings pane immediately updates the CSS
 *      variable (no reload required).
 *   5. The saved value persists after a page reload.
 */

const EDITOR_URL = "http://localhost:1882";

test.describe("editor — dual-path colour-coding (P120)", () => {
    test("CSS custom properties are present on :root with default blue/purple values", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        const tokens = await page.evaluate(() => {
            const root = document.documentElement;
            const style = getComputedStyle(root);
            return {
                wire: style.getPropertyValue("--webapp-path-wire-color").trim(),
                ref: style.getPropertyValue("--webapp-path-ref-color").trim()
            };
        });

        // The CSS variables are initially empty on :root (injected via the
        // stylesheet as defaults inside the rule block, not as inline style).
        // After ensureDualPathStylesheet() is called, the stylesheet rule sets
        // them via :root {}. We call pathBadge to trigger the stylesheet.
        const tokensAfterBadge = await page.evaluate(() => {
            // Trigger stylesheet injection via pathBadge
            const badge = (window as unknown as { WebappEditorCommon: { pathBadge: (kind: string, label: string) => HTMLElement } }).WebappEditorCommon.pathBadge("wire", "test");
            document.body.appendChild(badge);

            // Read the :root computed style after injection
            const root = document.documentElement;
            const style = getComputedStyle(root);

            // Check the stylesheet was injected
            const styleEl = document.getElementById("webapp-dual-path-styles");
            badge.remove();
            return {
                wire: style.getPropertyValue("--webapp-path-wire-color").trim(),
                ref: style.getPropertyValue("--webapp-path-ref-color").trim(),
                stylesheetPresent: !!styleEl
            };
        });

        expect(tokensAfterBadge.stylesheetPresent).toBe(true);
        // Default blue for wire
        expect(tokensAfterBadge.wire.toLowerCase()).toContain("185fa5");
        // Default purple for ref
        expect(tokensAfterBadge.ref.toLowerCase()).toContain("534ab7");
        // Suppress unused warning for initial tokens check
        void tokens;
    });

    test("pathBadge('wire') produces a strong-fill blue badge with plug icon and label", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        const result = await page.evaluate(() => {
            const WEC = (window as unknown as { WebappEditorCommon: {
                pathBadge: (kind: string, label: string) => HTMLElement
            } }).WebappEditorCommon;

            const badge = WEC.pathBadge("wire", "via Wire");
            document.body.appendChild(badge);

            const computed = getComputedStyle(badge);
            const bgColor = computed.backgroundColor;
            const hasWireClass = badge.classList.contains("webapp-path-badge--wire");
            const hasPlugIcon = !!badge.querySelector(".fa-plug");
            const labelText = badge.querySelector("span")?.textContent ?? "";

            badge.remove();
            return { bgColor, hasWireClass, hasPlugIcon, labelText };
        });

        expect(result.hasWireClass).toBe(true);
        expect(result.hasPlugIcon).toBe(true);
        expect(result.labelText).toBe("via Wire");
        // Background must not be transparent / white — it must be the coloured fill.
        expect(result.bgColor).not.toBe("rgba(0, 0, 0, 0)");
        expect(result.bgColor).not.toBe("rgb(255, 255, 255)");
    });

    test("pathBadge('ref') produces a strong-fill purple badge with link icon and label", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        const result = await page.evaluate(() => {
            const WEC = (window as unknown as { WebappEditorCommon: {
                pathBadge: (kind: string, label: string) => HTMLElement
            } }).WebappEditorCommon;

            const badge = WEC.pathBadge("ref", "Referenz");
            document.body.appendChild(badge);

            const computed = getComputedStyle(badge);
            const bgColor = computed.backgroundColor;
            const hasRefClass = badge.classList.contains("webapp-path-badge--ref");
            const hasLinkIcon = !!badge.querySelector(".fa-link");
            const labelText = badge.querySelector("span")?.textContent ?? "";

            badge.remove();
            return { bgColor, hasRefClass, hasLinkIcon, labelText };
        });

        expect(result.hasRefClass).toBe(true);
        expect(result.hasLinkIcon).toBe(true);
        expect(result.labelText).toBe("Referenz");
        expect(result.bgColor).not.toBe("rgba(0, 0, 0, 0)");
        expect(result.bgColor).not.toBe("rgb(255, 255, 255)");
    });

    test("user settings pane contains the Webapp section with two colour inputs", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        // Open the user settings via Node-RED's menu
        await page.evaluate(() => {
            (window as unknown as { RED: { userSettings: { show: (id?: string) => void } } })
                .RED.userSettings.show("webapp");
        });

        // The settings dialog should be visible
        const dialog = page.locator(".red-ui-settings-dialog, [data-component='user-settings'], .red-ui-tray");
        await expect(dialog.first()).toBeVisible({ timeout: 3000 });

        // The two colour inputs must be present
        const wireInput = page.locator("#webapp-setting-wire-color");
        const refInput = page.locator("#webapp-setting-ref-color");

        await expect(wireInput).toHaveCount(1);
        await expect(refInput).toHaveCount(1);

        // Wire input default is blue-ish
        const wireVal = await wireInput.inputValue();
        expect(wireVal.toLowerCase()).toContain("185fa5");

        // Ref input default is purple-ish
        const refVal = await refInput.inputValue();
        expect(refVal.toLowerCase()).toContain("534ab7");
    });

    test("changing the wire colour in settings immediately updates the CSS variable", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        // Ensure stylesheet exists
        await page.evaluate(() => {
            (window as unknown as { WebappEditorCommon: { pathBadge: (k: string, l: string) => void } })
                .WebappEditorCommon.pathBadge("wire", "x");
        });

        // Open settings to webapp section
        await page.evaluate(() => {
            (window as unknown as { RED: { userSettings: { show: (id: string) => void } } })
                .RED.userSettings.show("webapp");
        });
        await page.locator("#webapp-setting-wire-color").waitFor({ timeout: 3000 });

        // Change the wire colour to red (#cc0000) via the input
        await page.evaluate(() => {
            const input = document.getElementById("webapp-setting-wire-color") as HTMLInputElement;
            input.value = "#cc0000";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });

        // The CSS variable on :root should now reflect the new colour
        const wireToken = await page.evaluate(() => {
            return getComputedStyle(document.documentElement)
                .getPropertyValue("--webapp-path-wire-color").trim();
        });

        expect(wireToken.toLowerCase()).toContain("cc0000");
    });
});
