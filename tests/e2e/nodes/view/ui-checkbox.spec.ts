import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-checkbox (interactive view node).
 *
 * Covers:
 *   - rendering: sl-checkbox is visible with label text.
 *   - disabled renders sl-checkbox[disabled].
 *   - events: sl-change → POST /event { event:"change", params:{ checked: bool } }.
 *   - input port: inject { value: true } → sl-checkbox[checked].
 */

test.describe("ui-checkbox (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-checkbox element with label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp1", root: "cbApp1" })
            .route({ id: "cbRoute1", path: "/" })
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
            .route({ id: "cbRoute2", path: "/" })
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
            .route({ id: "cbRoute3", path: "/" })
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

    // ─── input port — state update ────────────────────────────────────────────

    test("inject true → sl-checkbox renders checked after SSE snapshot", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp4", root: "cbApp4" })
            .route({ id: "cbRoute4", path: "/" })
            .node("ui-checkbox", { id: "cbNode4", label: "Agreed" })
            .withInjectNode("cbInj4", "cbNode4", true)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "cbApp4");
        await webapp.navigate("/");

        // Fire the inject and then re-navigate so the snapshot reflects the patched value.
        await injectMessage(request, "cbInj4");

        // Re-navigate picks up the now-patched in-memory definition (no SSE needed).
        await webapp.navigate("/");
        await expect(page.locator("sl-checkbox[checked]")).toBeVisible();
    });
});
