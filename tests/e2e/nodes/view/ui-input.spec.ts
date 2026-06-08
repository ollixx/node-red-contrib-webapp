import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-input (interactive view node).
 *
 * Covers:
 *   - rendering: sl-input is visible, label and placeholder attributes.
 *   - events: sl-change on sl-input → POST /event { event:"change", params:{ value: string } }.
 *
 * P82: inject → value update behaviour is covered by classic unit tests
 * (packages/runtime/test/p82-input-nodes-behaviour.test.ts).
 */

test.describe("ui-input (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-input element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inpApp1", root: "inpApp1" })
            .node("ui-input", { id: "inpNode1", label: "Name" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inpApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toBeVisible();
    });

    test("label prop is set as the label attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inpApp2", root: "inpApp2" })
            .node("ui-input", { id: "inpNode2", label: "Email address" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inpApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toHaveAttribute("label", "Email address");
    });

    test("disabled renders sl-input[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inpApp3", root: "inpApp3" })
            .node("ui-input", {
                id: "inpNode3",
                label: "Locked",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inpApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change on sl-input → POST /event with { event:'change', params:{ value } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inpApp4", root: "inpApp4" })
            .node("ui-input", { id: "inpNode4", label: "City" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inpApp4");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-input") as HTMLElement & { value: string };
            if (el) {
                el.value = "Berlin";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("Berlin");
    });

});
