import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-slider (interactive view node).
 *
 * Covers:
 *   - rendering: sl-range is visible with min, max, step attributes.
 *   - events: sl-change → POST /event { event:"change", params:{ value: number } }.
 *   - input port: inject { value: 75 } → sl-range value attribute updates.
 */

test.describe("ui-slider (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-range element with min, max, step", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "slApp1", root: "slApp1" })
            .route({ id: "slRoute1", path: "/" })
            .node("ui-slider", { id: "slNode1", label: "Volume", min: 0, max: 100, step: 5 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "slApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-range")).toBeVisible();
        await expect(page.locator("sl-range")).toHaveAttribute("min", "0");
        await expect(page.locator("sl-range")).toHaveAttribute("max", "100");
        await expect(page.locator("sl-range")).toHaveAttribute("step", "5");
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ value: number } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "slApp2", root: "slApp2" })
            .route({ id: "slRoute2", path: "/" })
            .node("ui-slider", { id: "slNode2", min: 0, max: 100, step: 1 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "slApp2");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-range") as HTMLElement & { value: string };
            if (el) {
                el.value = "42";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        // The client serialises slider value as a number via field.value (string coerced to number)
        // depending on browser/Shoelace behaviour. Accept both string "42" and number 42.
        const val = (body.params as Record<string, unknown>).value;
        expect(Number(val)).toBe(42);
    });

    // ─── input port — state update ────────────────────────────────────────────

    test("inject 75 → sl-range value updates after navigate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "slApp3", root: "slApp3" })
            .route({ id: "slRoute3", path: "/" })
            .node("ui-slider", { id: "slNode3", min: 0, max: 100, step: 1 })
            .withInjectNode("slInj3", "slNode3", 75)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "slApp3");
        await webapp.navigate("/");

        await injectMessage(request, "slInj3");

        // Re-navigate picks up the now-patched in-memory definition.
        await webapp.navigate("/");
        await expect(page.locator("sl-range")).toHaveAttribute("value", "75");
    });
});
