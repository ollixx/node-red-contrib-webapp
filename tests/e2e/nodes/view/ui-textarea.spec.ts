import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-textarea (interactive view node).
 *
 * Covers:
 *   - rendering: sl-textarea is visible with label attribute.
 *   - events: sl-change → POST /event { event:"change", params:{ value: string } }.
 *
 * P82: inject → value update behaviour is covered by classic unit tests
 * (packages/runtime/test/p82-input-nodes-behaviour.test.ts).
 */

test.describe("ui-textarea (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-textarea with label attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp1", root: "taApp1" })
            .node("ui-textarea", { id: "taNode1", label: "Notes" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea")).toBeVisible();
        await expect(page.locator("sl-textarea")).toHaveAttribute("label", "Notes");
    });

    test("disabled renders sl-textarea[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp2", root: "taApp2" })
            .node("ui-textarea", {
                id: "taNode2",
                label: "Read-only notes",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea[disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp3", root: "taApp3" })
            .node("ui-textarea", { id: "taNode3", label: "Description" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-textarea") as HTMLElement & { value: string };
            if (el) {
                el.value = "My text";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("My text");
    });

});
