import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-select (interactive view node).
 *
 * Covers:
 *   - rendering: sl-select is visible with label and sl-option elements.
 *   - events: sl-change → POST /event { event:"change", params:{ value: string } }.
 *   - input port: inject { value: "b" } → sl-select value attribute updates.
 */

test.describe("ui-select (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-select with label and sl-option elements", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selApp1", root: "selApp1" })
            .route({ id: "selRoute1", path: "/" })
            .node("ui-select", {
                id: "selNode1",
                label: "Country",
                optionsJson: JSON.stringify([
                    { label: "Germany", value: "de" },
                    { label: "France", value: "fr" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toBeVisible();
        await expect(page.locator("sl-select")).toHaveAttribute("label", "Country");
        await expect(page.locator("sl-option[value='de']")).toBeAttached();
        await expect(page.locator("sl-option[value='fr']")).toBeAttached();
    });

    test("disabled renders sl-select[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selApp2", root: "selApp2" })
            .route({ id: "selRoute2", path: "/" })
            .node("ui-select", {
                id: "selNode2",
                label: "Locked",
                disabled: { kind: "literal", value: true },
                optionsJson: JSON.stringify([{ label: "A", value: "a" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-select[disabled]")).toBeVisible();
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selApp3", root: "selApp3" })
            .route({ id: "selRoute3", path: "/" })
            .node("ui-select", {
                id: "selNode3",
                label: "Lang",
                optionsJson: JSON.stringify([
                    { label: "EN", value: "en" },
                    { label: "DE", value: "de" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selApp3");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-select") as HTMLElement & { value: string };
            if (el) {
                el.value = "de";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("de");
    });

    // ─── input port — state update ────────────────────────────────────────────

    test("inject 'fr' → sl-select value updates after navigate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "selApp4", root: "selApp4" })
            .route({ id: "selRoute4", path: "/" })
            .node("ui-select", {
                id: "selNode4",
                label: "Country",
                optionsJson: JSON.stringify([
                    { label: "Germany", value: "de" },
                    { label: "France", value: "fr" }
                ])
            })
            .withInjectNode("selInj4", "selNode4", "fr")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "selApp4");
        await webapp.navigate("/");

        await injectMessage(request, "selInj4");

        // Re-navigate picks up the now-patched in-memory definition.
        await webapp.navigate("/");
        await expect(page.locator("sl-select")).toHaveAttribute("value", "fr");
    });
});
