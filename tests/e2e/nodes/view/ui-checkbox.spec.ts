import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-checkbox (interactive view node).
 *
 * Covers:
 *   - rendering: sl-checkbox is visible with label text.
 *   - disabled renders sl-checkbox[disabled].
 *   - events: sl-change → POST /event { event:"change", params:{ checked: bool } }.
 *
 * P82: inject → value update behaviour is covered by classic unit tests
 * (packages/runtime/test/p82-input-nodes-behaviour.test.ts).
 */

test.describe("ui-checkbox (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-checkbox element with label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp1", root: "cbApp1" })
            .node("ui-checkbox", { id: "cbNode1", label: "Accept terms" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "cbApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-checkbox")).toBeVisible();
        await expect(page.locator("sl-checkbox")).toContainText("Accept terms");
    });

    test("disabled renders sl-checkbox[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp2", root: "cbApp2" })
            .node("ui-checkbox", {
                id: "cbNode2",
                label: "Locked",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "cbApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-checkbox[disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ checked: bool } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp3", root: "cbApp3" })
            .node("ui-checkbox", { id: "cbNode3", label: "Subscribe" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "cbApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-checkbox") as HTMLElement & { checked: boolean };
            if (el) {
                el.checked = true;
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).checked).toBe(true);
    });

});
