import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P98 — ui-datepicker fresh E2E tests (per .ai/agents/node-testing.md).
 * Replaces the P44 presence-only tests and P73 mode-mapping tests.
 *
 * Each test asserts an observable OUTCOME (rendered attribute / DOM structure /
 * emitted event / action applied). A test turns RED if the feature is removed.
 *
 * Covers (see docs/nodes/input/ui-datepicker.md):
 *   - Render pipeline: sl-input[type=date] present with label attribute (regression guard)
 *   - Mode mapping: date → type=date, datetime → type=datetime-local, time → type=time
 *   - Value binding (literal date string): sl-input value attribute rendered
 *   - Disabled (literal true): sl-input[disabled] attribute present
 *   - Disabled (absent): no [disabled] attribute
 *   - Label binding (literal): label attribute matches literal value
 *   - change event: POST /event with { event:"change", params:{ value: string } }
 *
 * P82: inject → value update behaviour is covered by classic unit tests
 * (packages/runtime/test/p82-input-nodes-behaviour.test.ts).
 * show/hide verbs are covered by the cross-cutting ui-action-verbs.spec.ts.
 *
 * See: tests/e2e/nodes/view/ui-datepicker.tests.md
 */

test.describe("ui-datepicker (P98)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── Core render pipeline ─────────────────────────────────────────────────

    test("renders sl-input[type=date] with label attribute — regression guard", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp1", root: "dpApp1" })
            .node("ui-datepicker", { id: "dpNode1", label: "Birthday" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dpApp1");
        await webapp.navigate("/");
        // Outcome: sl-input element with type=date and label attribute is visible.
        await expect(page.locator('sl-input[type="date"]')).toBeVisible();
        await expect(page.locator('sl-input[type="date"]')).toHaveAttribute("label", "Birthday");
    });

    // ── Mode mapping ─────────────────────────────────────────────────────────

    test("mode='date' → sl-input[type=date]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp2", root: "dpApp2" })
            .node("ui-datepicker", { id: "dpNode2", label: "Date", mode: "date" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "dpApp2");
        await webapp.navigate("/");
        await expect(page.locator('sl-input[type="date"]')).toBeVisible();
    });

    test("mode='datetime' → sl-input[type=datetime-local]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp3", root: "dpApp3" })
            .node("ui-datepicker", { id: "dpNode3", label: "Datetime", mode: "datetime" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "dpApp3");
        await webapp.navigate("/");
        await expect(page.locator('sl-input[type="datetime-local"]')).toBeVisible();
        await expect(page.locator('sl-input[type="date"]')).not.toBeVisible();
    });

    test("mode='time' → sl-input[type=time]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp4", root: "dpApp4" })
            .node("ui-datepicker", { id: "dpNode4", label: "Time", mode: "time" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "dpApp4");
        await webapp.navigate("/");
        await expect(page.locator('sl-input[type="time"]')).toBeVisible();
        await expect(page.locator('sl-input[type="date"]')).not.toBeVisible();
    });

    // ── Value rendering ──────────────────────────────────────────────────────

    test("value literal binding renders as value attribute on sl-input", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp5", root: "dpApp5" })
            .node("ui-datepicker", {
                id: "dpNode5",
                label: "Date",
                value: { kind: "literal", value: "2024-06-15" }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "dpApp5");
        await webapp.navigate("/");
        // Outcome: the sl-input carries the correct value attribute.
        await expect(page.locator('sl-input[type="date"]')).toHaveAttribute("value", "2024-06-15");
    });

    // ── Disabled attribute ───────────────────────────────────────────────────

    test("disabled literal true → sl-input[disabled] attribute present", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp6", root: "dpApp6" })
            .node("ui-datepicker", {
                id: "dpNode6",
                label: "Locked date",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "dpApp6");
        await webapp.navigate("/");
        await expect(page.locator('sl-input[type="date"][disabled]')).toBeVisible();
    });

    test("disabled absent → no [disabled] attribute on sl-input", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp7", root: "dpApp7" })
            .node("ui-datepicker", { id: "dpNode7", label: "Enabled" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "dpApp7");
        await webapp.navigate("/");
        await expect(page.locator('sl-input[type="date"]')).toBeVisible();
        // Must NOT have disabled attribute
        await expect(page.locator('sl-input[type="date"][disabled]')).not.toBeVisible();
    });

    // ── Label binding ────────────────────────────────────────────────────────

    test("label as literal binding → sl-input label attribute matches", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp8", root: "dpApp8" })
            .node("ui-datepicker", {
                id: "dpNode8",
                label: { kind: "literal", value: "Geburtsdatum" },
                value: { kind: "literal", value: "" }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "dpApp8");
        await webapp.navigate("/");
        // Outcome: the label attribute is rendered with the literal value.
        await expect(page.locator('sl-input[type="date"]')).toHaveAttribute("label", "Geburtsdatum");
    });

    // ── change event ─────────────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "dpApp9", root: "dpApp9" })
            .node("ui-datepicker", { id: "dpNode9", label: "Date" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "dpApp9");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector('sl-input[type="date"]') as HTMLElement & { value: string };
            if (el) {
                el.value = "2024-06-01";
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        // Outcome: event is dispatched with the correct event name and value param.
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("2024-06-01");
    });
});
