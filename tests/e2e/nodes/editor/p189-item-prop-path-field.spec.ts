import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P189 (editor counterpart to P184) — the scope-local `item`/`prop` PATH sub-field:
 *
 *   (1) UX hint: when the value binding's kind is `item` (or `prop`) the path
 *       field shows an inline hint that an EMPTY path = the whole element/prop
 *       ("leer = ganzes Element"). Without it, users type `item` as the value and
 *       get `?` at render time.
 *   (2) Validation fix (the real bug): the carrier field's `required: true` was
 *       TYPE-BLIND and marked an empty `item`/`index` path RED. Validation is now
 *       type-aware — an empty path is VALID for item/index (whole element / bare
 *       index, per P184) while a data-binding kind (state/query/…) still requires
 *       a non-empty path.
 *
 * EDITOR specs: open a ui-text panel mounted inside a ui-repeat, drive its value
 * typedInput, and read both the live hint DOM and Node-RED's own `node.valid`.
 */

// Read the visible text of the P189 path hint mounted under #node-input-text.
async function pathHintText(page: Page): Promise<string> {
    return page.evaluate(() => {
        const el = document.getElementById("webapp-binding-path-hint-nodeinputtext");
        if (!el) {
            return "";
        }
        const style = window.getComputedStyle(el);
        if (style.display === "none") {
            return "";
        }
        return (el.textContent ?? "").trim();
    });
}

// Set the value typedInput's kind + value, then let Node-RED re-validate the node.
async function setBinding(page: Page, type: string, value: string): Promise<void> {
    await page.evaluate(
        (args: { type: string; value: string }) => {
            const $ = (window as unknown as { $: (sel: string) => { typedInput: (...a: unknown[]) => unknown } }).$;
            const el = $("#node-input-text");
            el.typedInput("type", args.type);
            el.typedInput("value", args.value);
        },
        { type, value }
    );
    // Let the change handlers (hint re-eval + validity recompute) flush.
    await page.waitForTimeout(150);
}

function repeatFlow() {
    return new FlowBuilder()
        .app({ id: "p189App", root: "p189App", name: "P189 App" })
        .node("ui-repeat", { id: "p189Repeat", mount: "p189App.content", itemsPath: "rows" })
        .node("ui-text", { id: "p189Text", mount: "container:p189Repeat/content", text: "Row" })
        .build();
}

test.describe("editor — item/prop path field hint + type-aware validation (P189)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("the path hint appears for the item kind and explains empty = whole element", async ({ page, request }) => {
        await deployFlow(request, repeatFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p189Text");

        // A data-binding kind shows NO path hint.
        await setBinding(page, "query", "rows.total");
        expect(await pathHintText(page)).toBe("");

        // Switching to the scope-local `item` kind surfaces the hint.
        await setBinding(page, "item", "");
        const hint = await pathHintText(page);
        expect(hint).toContain("leer = ganzes Element");
        expect(hint.toLowerCase()).toContain("feldpfad");
    });

    test("an empty item path keeps the node VALID; an empty query path flags INVALID", async ({ page, request }) => {
        await deployFlow(request, repeatFlow());

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("p189Text");

        // item + EMPTY path = whole element → legitimate (P184), node stays green.
        await setBinding(page, "item", "");
        await editor.save();
        expect(await editor.getValidationState("p189Text")).toBe("valid");

        // index is path-free → also valid.
        await editor.openNode("p189Text");
        await setBinding(page, "index", "");
        await editor.save();
        expect(await editor.getValidationState("p189Text")).toBe("valid");

        // A data-binding kind with an EMPTY path still flags the node red.
        await editor.openNode("p189Text");
        await setBinding(page, "query", "");
        await editor.save();
        expect(await editor.getValidationState("p189Text")).toBe("invalid");

        // …and filling the query path clears the error.
        await editor.openNode("p189Text");
        await setBinding(page, "query", "rows.total");
        await editor.save();
        expect(await editor.getValidationState("p189Text")).toBe("valid");
    });
});
