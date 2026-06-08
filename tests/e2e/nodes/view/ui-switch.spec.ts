import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-switch (interactive view node).
 *
 * Covers:
 *   - rendering: sl-switch is visible with label text.
 *   - disabled renders sl-switch[disabled].
 *   - events: sl-change → POST /event { event:"change", params:{ checked: bool } }.
 *
 * P82: inject → value update behaviour is covered by classic unit tests
 * (packages/runtime/test/p82-input-nodes-behaviour.test.ts).
 */

test.describe("ui-switch (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-switch element with label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "swApp1", root: "swApp1" })
            .node("ui-switch", { id: "swNode1", label: "Dark mode" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "swApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-switch")).toBeVisible();
        await expect(page.locator("sl-switch")).toContainText("Dark mode");
    });

    test("disabled renders sl-switch[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "swApp2", root: "swApp2" })
            .node("ui-switch", {
                id: "swNode2",
                label: "Locked",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "swApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-switch[disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ checked: bool } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "swApp3", root: "swApp3" })
            .node("ui-switch", { id: "swNode3", label: "Enable" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "swApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-switch") as HTMLElement & { checked: boolean };
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
