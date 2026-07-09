import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * Owner (2026-07-09): a ui-input's `change` event should fire on EVERY change
 * (per keystroke), but it only reacts on unfocus. Root cause: the client bound
 * the change emit to native `change` + `sl-change`, which Shoelace fires only on
 * commit/blur. Per-keystroke is `input` / `sl-input`. The docs already say
 * `change` = „jede Änderung des Feldwerts". Fix: also listen to input/sl-input,
 * with a per-source value-dedupe so the trailing blur `sl-change` (same value)
 * does not double-emit.
 */

type Body = { event?: string; params?: { value?: unknown } };

test.describe("ui-input — change fires per keystroke, not only on blur", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    async function setup(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
        const flow = new FlowBuilder()
            .app({ id: "kbApp", root: "kbApp" })
            .node("ui-input", { id: "kbInput", label: "Search", events: JSON.stringify(["change"]) })
            .build();
        await deployFlow(request, flow);

        const changes: string[] = [];
        page.on("request", (req) => {
            if (req.method() !== "POST" || !req.url().includes("/event")) return;
            let body: Body = {};
            try { body = JSON.parse(req.postData() || "{}") as Body; } catch { /* ignore */ }
            if (body.event === "change") changes.push(String(body.params?.value ?? ""));
        });

        const webapp = new WebappPage(page, "kbApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toBeVisible();
        return changes;
    }

    // Dispatch an sl-input event (what Shoelace fires per keystroke) with a value.
    async function keystroke(page: import("@playwright/test").Page, value: string) {
        await page.evaluate((v) => {
            const el = document.querySelector("sl-input") as (HTMLElement & { value: string }) | null;
            if (el) {
                el.value = v;
                el.dispatchEvent(new CustomEvent("sl-input", { bubbles: true, composed: true }));
            }
        }, value);
    }

    test("three keystrokes emit three change events with the intermediate values", async ({ page, request }) => {
        const changes = await setup(page, request);

        await keystroke(page, "B");
        await keystroke(page, "Be");
        await keystroke(page, "Ber");

        await expect.poll(() => changes.length).toBe(3);
        expect(changes).toEqual(["B", "Be", "Ber"]);
    });

    test("the trailing blur sl-change with the same value does not double-emit", async ({ page, request }) => {
        const changes = await setup(page, request);

        await keystroke(page, "Ber");
        // blur commit with the SAME value → must be deduped
        await page.evaluate(() => {
            const el = document.querySelector("sl-input") as (HTMLElement & { value: string }) | null;
            if (el) el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });

        await expect.poll(() => changes.length).toBe(1);
        expect(changes).toEqual(["Ber"]);
    });
});
