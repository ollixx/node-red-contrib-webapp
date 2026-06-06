import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-radio (interactive view node).
 *
 * Covers:
 *   - rendering: sl-radio-group is visible with label and sl-radio options.
 *   - events: sl-change → POST /event { event:"change", params:{ value: string } }.
 *   - input port: inject { value: "b" } → radio group updates its value attribute.
 */

test.describe("ui-radio (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-radio-group with label and sl-radio options", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rdApp1", root: "rdApp1" })
            .node("ui-radio", {
                id: "rdNode1",
                label: "Size",
                optionsJson: JSON.stringify([
                    { label: "Small", value: "s" },
                    { label: "Large", value: "l" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rdApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group")).toBeVisible();
        await expect(page.locator("sl-radio-group")).toHaveAttribute("label", "Size");
        await expect(page.locator("sl-radio[value='s']")).toBeVisible();
        await expect(page.locator("sl-radio[value='l']")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change on sl-radio-group → POST /event with { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rdApp2", root: "rdApp2" })
            .node("ui-radio", {
                id: "rdNode2",
                label: "Color",
                optionsJson: JSON.stringify([
                    { label: "Red", value: "red" },
                    { label: "Blue", value: "blue" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rdApp2");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-radio-group") as HTMLElement & { value: string };
            if (el) {
                el.value = "blue";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("blue");
    });

    // ─── input port — state update ────────────────────────────────────────────

    test("inject 'l' → sl-radio-group value updates after navigate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rdApp3", root: "rdApp3" })
            .node("ui-radio", {
                id: "rdNode3",
                label: "Size",
                optionsJson: JSON.stringify([
                    { label: "Small", value: "s" },
                    { label: "Large", value: "l" }
                ])
            })
            .withInjectNode("rdInj3", "rdNode3", "l")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rdApp3");
        await webapp.navigate("/");

        await injectMessage(request, "rdInj3");

        // Re-navigate picks up the now-patched in-memory definition.
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group")).toHaveAttribute("value", "l");
    });
});
