import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-datepicker (interactive view node).
 *
 * The datepicker serialises as <sl-input type="date"> (see webapp-serializer.js).
 *
 * Covers:
 *   - rendering: sl-input[type=date] is visible with label attribute.
 *   - events: sl-change → POST /event { event:"change", params:{ value: string } }.
 *   - input port: inject { value: "2024-06-01" } → sl-input value attribute updates.
 */

test.describe("ui-datepicker (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-input[type=date] with label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp1", root: "dpApp1" })
            .node("ui-datepicker", { id: "dpNode1", label: "Birthday" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dpApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[type=date]")).toBeVisible();
        await expect(page.locator("sl-input[type=date]")).toHaveAttribute("label", "Birthday");
    });

    test("disabled renders sl-input[type=date][disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp2", root: "dpApp2" })
            .node("ui-datepicker", {
                id: "dpNode2",
                label: "Locked date",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dpApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[type=date][disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp3", root: "dpApp3" })
            .node("ui-datepicker", { id: "dpNode3", label: "Date" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dpApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-input[type=date]") as HTMLElement & { value: string };
            if (el) {
                el.value = "2024-06-01";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("2024-06-01");
    });

    // ─── input port — state update ────────────────────────────────────────────

    test("inject '2025-12-31' → sl-input[type=date] value updates after navigate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp4", root: "dpApp4" })
            .node("ui-datepicker", { id: "dpNode4", label: "Due date" })
            .withInjectNode("dpInj4", "dpNode4", "2025-12-31")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dpApp4");
        await webapp.navigate("/");

        await injectMessage(request, "dpInj4");

        // Re-navigate picks up the now-patched in-memory definition.
        await webapp.navigate("/");
        await expect(page.locator("sl-input[type=date]")).toHaveAttribute("value", "2025-12-31");
    });
});
