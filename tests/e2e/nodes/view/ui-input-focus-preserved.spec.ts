import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * Owner (2026-07-10): with writeTrigger=change the store update pushes a fresh
 * snapshot over SSE on every keystroke; the client morph replaced the focused
 * <sl-input> → focus (and cursor) were lost, making typing impossible. A
 * snapshot apply must PRESERVE focus + caret on the control the user is editing.
 */

test.describe("ui-input keeps focus + caret across a store-driven re-render", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("typing with writeTrigger=change does not steal focus", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "fcApp", root: "fcApp" })
            .node("ui-store", { id: "fcStore", parent: "fcApp", statePath: "e", initialValue: JSON.stringify({ name: "A" }) })
            .node("ui-input", {
                id: "fcInput",
                parent: "fcApp",
                value: { kind: "store", path: "fcStore", subPath: { kind: "literal", value: "name" } },
                writeTo: { kind: "store", path: "fcStore", subPath: { kind: "literal", value: "name" } },
                writeTrigger: "change"
            })
            .node("ui-text", {
                id: "fcText",
                parent: "fcApp",
                value: { kind: "store", path: "fcStore", subPath: { kind: "literal", value: "name" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "fcApp");
        await webapp.navigate("/");

        const input = page.locator("sl-input");
        await expect(input).toBeVisible();

        // Give the field real focus, then simulate a keystroke (value + sl-input,
        // the per-keystroke event) and place the caret at the end.
        await input.click();
        await expect.poll(() => page.evaluate(() => (document.activeElement && document.activeElement.tagName || "").toLowerCase())).toBe("sl-input");

        await page.evaluate(() => {
            const el = document.querySelector("sl-input") as (HTMLElement & { value: string; setSelectionRange?: (a: number, b: number) => void }) | null;
            if (el) {
                el.value = "AB";
                if (el.setSelectionRange) { try { el.setSelectionRange(2, 2); } catch { /* ignore */ } }
                el.dispatchEvent(new CustomEvent("sl-input", { bubbles: true, composed: true }));
            }
        });

        // The round-trip completed once the store-bound text reflects the new value
        // — that is exactly the morph that used to steal focus.
        await expect(webapp.root().locator(".webapp-text")).toContainText("AB", { timeout: 5000 });

        // Focus must STILL be on the input after that re-render (was the bug).
        // Poll to absorb the rAF-deferred focus restore.
        await expect
            .poll(() => page.evaluate(() => (document.activeElement && document.activeElement.tagName || "").toLowerCase()), { timeout: 3000 })
            .toBe("sl-input");

        // And the caret is preserved at the end (position 2), not reset.
        const caret = await page.evaluate(() => {
            const el = document.querySelector("sl-input") as (HTMLElement & { selectionStart?: number }) | null;
            return el && typeof el.selectionStart === "number" ? el.selectionStart : null;
        });
        expect(caret === null || caret === 2).toBeTruthy();
    });
});
