import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P106 — Editor: ui-app `status` (deploy mode) field.
 *
 * The ui-app panel exposes a Status select (Entwicklung / Produktion). It
 * defaults to "development", and round-trips its value into the stored node
 * config so the runtime can branch the deploy delivery (in-place auto-update vs
 * version-alert). See docs/nodes/concepts/live-deploy-update.md.
 */

test.describe("ui-app Status select (P106)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the Status select is present and defaults to 'development' (Entwicklung)", async ({ page, request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "statusApp1", root: "statusApp1" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("statusApp1");

        await expect(page.locator("#node-input-deployMode")).toBeVisible();
        const val = await page.locator("#node-input-deployMode").inputValue();
        expect(val).toBe("development");
    });

    test("round-trip: selecting 'Produktion' stores deployMode=production", async ({ page, request }) => {
        await deployFlow(request, new FlowBuilder().app({ id: "statusApp2", root: "statusApp2" }).build());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("statusApp2");

        await page.locator("#node-input-deployMode").selectOption("production");
        await editor.save();

        const stored = await page.evaluate(() => {
            const node = RED.nodes.node("statusApp2") as { deployMode?: string } | null;
            return node ? node.deployMode : undefined;
        });
        expect(stored).toBe("production");

        // Re-open and verify the select reflects the stored value.
        await editor.openNode("statusApp2");
        expect(await page.locator("#node-input-deployMode").inputValue()).toBe("production");
    });
});
