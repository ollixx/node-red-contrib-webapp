import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * Owner (2026-07-10): with writeTrigger=change the store update pushes a fresh
 * snapshot over SSE on every keystroke; the client morph disturbed the focused
 * <sl-input> — focus was lost and, more insidiously, the caret jumped to 0 so
 * "hello" typed as "olleh". Typing into a bound input must be lossless: the
 * focused control's DOM node (and its caret) survive the re-render untouched
 * while sibling views still update.
 */

test.describe("ui-input keeps focus + caret across a store-driven re-render", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("sequential typing with writeTrigger=change is lossless (caret not reset)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "fcApp", root: "fcApp" })
            .node("ui-store", { id: "fcStore", app: "fcApp", statePath: "e", initialValue: JSON.stringify({ name: "" }) })
            .node("ui-input", {
                id: "fcInput",
                app: "fcApp",
                value: { kind: "store", path: "fcStore", subPath: { kind: "literal", value: "name" } },
                writeTo: { kind: "store", path: "fcStore", subPath: { kind: "literal", value: "name" } },
                writeTrigger: "change"
            })
            .node("ui-text", {
                id: "fcText",
                app: "fcApp",
                value: { kind: "store", path: "fcStore", subPath: { kind: "literal", value: "name" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "fcApp");
        await webapp.navigate("/");

        const input = page.locator("sl-input");
        await expect(input).toBeVisible();
        await input.click();

        // Type real characters one at a time; each triggers a store write + SSE
        // morph. A caret reset would scramble the order ("hello" → "olleh").
        for (const ch of ["h", "e", "l", "l", "o"]) {
            await page.keyboard.type(ch);
            await page.waitForTimeout(120);
        }

        // The value landed in order — caret was preserved across every morph.
        const value = await page.evaluate(() => {
            const el = document.querySelector("sl-input") as (HTMLElement & { value: string }) | null;
            return el ? el.value : null;
        });
        expect(value).toBe("hello");

        // Focus is still on the input.
        const activeTag = await page.evaluate(() => (document.activeElement && document.activeElement.tagName || "").toLowerCase());
        expect(activeTag).toBe("sl-input");

        // And the store-bound sibling view reflects the final value (the morph ran).
        await expect(webapp.root().locator(".webapp-text")).toContainText("hello", { timeout: 5000 });
    });
});
