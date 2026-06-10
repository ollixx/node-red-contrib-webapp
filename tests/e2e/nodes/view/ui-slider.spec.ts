import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P126 — per-node E2E specs for ui-slider (ADR 0012 binding ubiquity).
 *
 * Covers (see tests/e2e/nodes/view/ui-slider.tests.md):
 *   R01–R03  rendering: sl-range visible, min/max/step attributes, label.
 *   V01–V03  value binding: literal number, state binding, valuePath migration.
 *   D01–D03  disabled binding: literal true/false, Store binding → live disable.
 *   E01      events: sl-change → change event with numeric value.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree —
 * the orchestrator runs the full E2E suite on the merged develop branch.
 */

test.describe("ui-slider (P126)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("R01 — renders sl-range element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl01App", root: "sl01App" })
            .node("ui-slider", { id: "sl01", label: "Volume", min: 0, max: 100, step: 5 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl01App");
        await webapp.navigate("/");
        await expect(page.locator("sl-range")).toBeVisible();
    });

    test("R02 — min, max, step attributes are set on sl-range", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl02App", root: "sl02App" })
            .node("ui-slider", { id: "sl02", min: 10, max: 200, step: 0.5 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl02App");
        await webapp.navigate("/");
        const sl = page.locator("sl-range");
        await expect(sl).toHaveAttribute("min", "10");
        await expect(sl).toHaveAttribute("max", "200");
        await expect(sl).toHaveAttribute("step", "0.5");
    });

    test("R03 — label prop sets label attribute on sl-range", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl03App", root: "sl03App" })
            .node("ui-slider", { id: "sl03", label: "Brightness", min: 0, max: 100, step: 1 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl03App");
        await webapp.navigate("/");
        await expect(page.locator("sl-range")).toHaveAttribute("label", "Brightness");
    });

    // ─── value binding (P126 — full canonical set) ───────────────────────────

    test("V01 — value literal number binding sets initial slider value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl04App", root: "sl04App" })
            .node("ui-slider", {
                id: "sl04",
                min: 0,
                max: 100,
                step: 1,
                value: { kind: "literal", value: 42 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl04App");
        await webapp.navigate("/");
        const val = await page.locator("sl-range").evaluate(
            (el) => (el as HTMLElement & { value: string | number }).value
        );
        expect(Number(val)).toBe(42);
    });

    test("V02 — value state binding resolves live value from client-state", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl05App", root: "sl05App" })
            .node("ui-store", {
                id: "sl05Store",
                statePath: "sliderState",
                initialValue: JSON.stringify(75)
            })
            .node("ui-slider", {
                id: "sl05",
                min: 0,
                max: 100,
                step: 1,
                value: { kind: "state", path: "sliderState" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl05App");
        await webapp.navigate("/");
        const val = await page.locator("sl-range").evaluate(
            (el) => (el as HTMLElement & { value: string | number }).value
        );
        expect(Number(val)).toBe(75);
    });

    test("V03 — legacy valuePath migrated: slider shows correct initial value", async ({ page, request }) => {
        // Simulate a pre-P126 node config: value=null, valuePath set.
        // The runtime falls back to valuePath as a state binding.
        const flow = new FlowBuilder()
            .app({ id: "sl06App", root: "sl06App" })
            .node("ui-store", {
                id: "sl06Store",
                statePath: "legacySlider",
                initialValue: JSON.stringify(30)
            })
            .node("ui-slider", {
                id: "sl06",
                min: 0,
                max: 100,
                step: 1,
                value: null,
                valuePath: "legacySlider"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl06App");
        await webapp.navigate("/");
        const val = await page.locator("sl-range").evaluate(
            (el) => (el as HTMLElement & { value: string | number }).value
        );
        expect(Number(val)).toBe(30);
    });

    // ─── disabled binding (P126 — boolean state set) ─────────────────────────

    test("D01 — disabled literal true renders sl-range[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl07App", root: "sl07App" })
            .node("ui-slider", {
                id: "sl07",
                min: 0,
                max: 100,
                step: 1,
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl07App");
        await webapp.navigate("/");
        await expect(page.locator("sl-range[disabled]")).toBeVisible();
    });

    test("D02 — disabled literal false renders sl-range without disabled attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl08App", root: "sl08App" })
            .node("ui-slider", {
                id: "sl08",
                min: 0,
                max: 100,
                step: 1,
                disabled: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl08App");
        await webapp.navigate("/");
        await expect(page.locator("sl-range")).toBeVisible();
        const disabledAttr = await page.locator("sl-range").getAttribute("disabled");
        expect(disabledAttr).toBeNull();
    });

    test("D03 — disabled store binding disables slider live when store value becomes truthy", async ({ page, request }) => {
        // Initially store is false → slider enabled; inject true → slider disabled.
        const flow = new FlowBuilder()
            .app({ id: "sl09App", root: "sl09App" })
            .node("ui-store", {
                id: "sl09Store",
                statePath: "sliderDisabled",
                initialValue: JSON.stringify(false)
            })
            .node("ui-slider", {
                id: "sl09",
                min: 0,
                max: 100,
                step: 1,
                disabled: { kind: "store", path: "sl09Store" }
            })
            .withStoreInject("sl09Inj", "sl09Store", true)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl09App");
        await webapp.navigate("/");

        // Initially enabled.
        const disabledBefore = await page.locator("sl-range").getAttribute("disabled");
        expect(disabledBefore).toBeNull();

        // Inject true into store → slider should become disabled.
        await injectMessage(request, "sl09Inj");
        await expect(page.locator("sl-range[disabled]")).toBeVisible({ timeout: 5000 });
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("E01 — sl-change → POST /event { event:'change', params:{ value: number } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "sl10App", root: "sl10App" })
            .node("ui-slider", { id: "sl10", min: 0, max: 100, step: 1 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "sl10App");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-range") as HTMLElement & { value: string };
            if (el) {
                el.value = "55";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        const val = (body.params as Record<string, unknown>).value;
        expect(Number(val)).toBe(55);
    });
});
