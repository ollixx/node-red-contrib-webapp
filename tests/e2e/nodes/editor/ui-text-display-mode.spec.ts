import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P221 (ADR 0035) — ui-text `display` presentation-mode editor.
 *
 * `display` is a PLAIN native <select> (no hidden carrier), so it does not need
 * the ADR-0031 round-trip harness — a lightweight open→save persistence check
 * plus the label-row DEPENDENCY toggle is enough:
 *   - the `display` select is present with `text` (default) selected;
 *   - the `label` row is hidden in text mode and revealed in formField mode
 *     (the documented dependency of `label` on `display`);
 *   - choosing formField + a label persists through Done (open→save→reopen).
 */

function buildFlow(): unknown {
    return new FlowBuilder()
        .app({ id: "dispApp", root: "dispApp", name: "Disp App" })
        .node("ui-text", { id: "dispText", text: "Hello" })
        .build();
}

test.describe("editor — ui-text display mode (P221)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("display select present, defaults to text; label row hidden until formField", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("dispText");

        await expect(page.locator("#node-input-display")).toHaveCount(1);
        expect(await editor.readField("display")).toBe("text");

        // Dependency: the Field Label row is hidden in text mode.
        await expect(page.locator("#ui-text-label-row")).toBeHidden();

        // Switching to formField reveals the label row.
        await editor.fillField("display", "formField");
        await expect(page.locator("#ui-text-label-row")).toBeVisible();

        // Switching back hides it again.
        await editor.fillField("display", "text");
        await expect(page.locator("#ui-text-label-row")).toBeHidden();
    });

    test("formField + label persist through open→save→reopen", async ({ page, request }) => {
        await deployFlow(request, buildFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("dispText");

        await editor.fillField("display", "formField");
        await editor.fillField("label", "Entity ID");
        await editor.save();

        // Persisted onto the node model (Node-RED copies plain defaults on Done).
        const persisted = await page.evaluate((id) => {
            const n = RED.nodes.node(id) as unknown as { display?: string; label?: string };
            return { display: n?.display, label: n?.label };
        }, "dispText");
        expect(persisted.display).toBe("formField");
        expect(persisted.label).toBe("Entity ID");

        // Reopen: the values are seeded back and the label row is visible.
        await editor.openNode("dispText");
        expect(await editor.readField("display")).toBe("formField");
        expect(await editor.readField("label")).toBe("Entity ID");
        await expect(page.locator("#ui-text-label-row")).toBeVisible();
    });
});
