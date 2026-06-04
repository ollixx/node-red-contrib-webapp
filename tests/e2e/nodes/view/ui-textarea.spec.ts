import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P44 — per-node E2E specs for ui-textarea (interactive view node).
 *
 * Covers:
 *   - rendering: sl-textarea is visible with label attribute.
 *   - events: sl-change → POST /event { event:"change", params:{ value: string } }.
 *   - input port: inject { value: "hello" } → sl-textarea value attribute updates.
 */

test.describe("ui-textarea (P44)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("renders sl-textarea with label attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp1", root: "taApp1" })
            .route({ id: "taRoute1", path: "/" })
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
            .route({ id: "taRoute2", path: "/" })
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
            .route({ id: "taRoute3", path: "/" })
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

    // ─── input port — state update ────────────────────────────────────────────

    test("inject 'Updated notes' → sl-textarea value updates after navigate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "taApp4", root: "taApp4" })
            .route({ id: "taRoute4", path: "/" })
            .node("ui-textarea", { id: "taNode4", label: "Notes" })
            .withInjectNode("taInj4", "taNode4", "Updated notes")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "taApp4");
        await webapp.navigate("/");

        await injectMessage(request, "taInj4");

        // Re-navigate picks up the now-patched in-memory definition.
        await webapp.navigate("/");
        await expect(page.locator("sl-textarea")).toHaveAttribute("value", "Updated notes");
    });
});
