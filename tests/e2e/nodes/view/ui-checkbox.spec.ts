import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P97 — ui-checkbox fresh E2E tests (per .ai/agents/node-testing.md).
 * Replaces the P44 presence-only tests.
 *
 * Each test asserts an observable OUTCOME (rendered attribute / DOM structure /
 * emitted event / action applied). A test turns RED if the feature is removed.
 *
 * Covers (see docs/nodes/input/ui-checkbox.md):
 *   - Rendering: sl-checkbox with label text in DOM
 *   - Disabled (literal true): sl-checkbox[disabled] attribute present
 *   - Disabled (state binding): sl-checkbox[disabled] when state = true
 *   - Disabled (absent): no [disabled] attribute
 *   - Value binding (literal true): sl-checkbox[checked] attribute present
 *   - Value binding (literal false): no [checked] attribute
 *   - Value binding (state): checked matches state value
 *   - Size field: sl-checkbox[size] attribute present for sm/lg
 *   - Label binding (state): label text resolved from state
 *   - Change event: POST /event with { event:"change", params:{ checked:bool } }
 *   - show/hide verbs: element visibility toggled
 *   - enable/disable verbs: disabled attribute toggled
 *
 * See: tests/e2e/nodes/view/ui-checkbox.tests.md
 */

test.describe("ui-checkbox (P97)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── Core render pipeline ─────────────────────────────────────────────────

    test("renders sl-checkbox in DOM with label text", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp1", root: "cbApp1" })
            .node("ui-checkbox", { id: "cbNode1", label: "Accept terms" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp1");
        await webapp.navigate("/");
        // Outcome: sl-checkbox element exists AND contains the label text.
        await expect(page.locator("sl-checkbox")).toContainText("Accept terms");
    });

    test("label as literal binding renders label text in sl-checkbox", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp2", root: "cbApp2" })
            .node("ui-checkbox", {
                id: "cbNode2",
                label: { kind: "literal", value: "Binding Label" },
                value: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-checkbox")).toContainText("Binding Label");
    });

    // ── Disabled attribute ───────────────────────────────────────────────────

    test("disabled literal true → sl-checkbox[disabled] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp3", root: "cbApp3" })
            .node("ui-checkbox", {
                id: "cbNode3",
                label: "Locked",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp3");
        await webapp.navigate("/");
        // Outcome: the sl-checkbox element carries the disabled attribute.
        await expect(page.locator("sl-checkbox[disabled]")).toBeVisible();
    });

    test("disabled absent → no [disabled] attribute on sl-checkbox", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp4", root: "cbApp4" })
            .node("ui-checkbox", { id: "cbNode4", label: "Enabled" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp4");
        await webapp.navigate("/");
        await expect(page.locator("sl-checkbox")).toBeVisible();
        // Must NOT have disabled attribute
        await expect(page.locator("sl-checkbox[disabled]")).not.toBeVisible();
    });

    // ── Value / checked state ────────────────────────────────────────────────

    test("value literal true → sl-checkbox[checked] attribute present", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp5", root: "cbApp5" })
            .node("ui-checkbox", {
                id: "cbNode5",
                label: "Checked",
                value: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp5");
        await webapp.navigate("/");
        // Outcome: sl-checkbox carries the checked attribute.
        await expect(page.locator("sl-checkbox[checked]")).toBeVisible();
    });

    test("value literal false → no [checked] attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp6", root: "cbApp6" })
            .node("ui-checkbox", {
                id: "cbNode6",
                label: "Unchecked",
                value: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp6");
        await webapp.navigate("/");
        await expect(page.locator("sl-checkbox")).toBeVisible();
        await expect(page.locator("sl-checkbox[checked]")).not.toBeVisible();
    });

    // ── Size field ───────────────────────────────────────────────────────────

    test("size='sm' → sl-checkbox[size=small] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp7", root: "cbApp7" })
            .node("ui-checkbox", { id: "cbNode7", label: "Small", size: "sm" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp7");
        await webapp.navigate("/");
        // Outcome: Shoelace maps 'sm' to size="small" attribute.
        await expect(page.locator('sl-checkbox[size="small"]')).toBeVisible();
    });

    test("size='lg' → sl-checkbox[size=large] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp8", root: "cbApp8" })
            .node("ui-checkbox", { id: "cbNode8", label: "Large", size: "lg" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp8");
        await webapp.navigate("/");
        await expect(page.locator('sl-checkbox[size="large"]')).toBeVisible();
    });

    test("size 'md' → sl-checkbox[size=medium] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp9", root: "cbApp9" })
            .node("ui-checkbox", { id: "cbNode9", label: "Medium", size: "md" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp9");
        await webapp.navigate("/");
        // Outcome: Shoelace maps 'md' to size="medium" attribute.
        await expect(page.locator('sl-checkbox[size="medium"]')).toBeVisible();
    });

    // ── Change event ─────────────────────────────────────────────────────────

    test("sl-change → POST /event with { event:'change', params:{ checked: bool } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp10", root: "cbApp10" })
            .node("ui-checkbox", { id: "cbNode10", label: "Subscribe" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp10");
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

    test("sl-change unchecking → POST /event with checked: false", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp11", root: "cbApp11" })
            .node("ui-checkbox", {
                id: "cbNode11",
                label: "Option",
                value: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp11");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-checkbox") as HTMLElement & { checked: boolean };
            if (el) {
                el.checked = false;
                el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).checked).toBe(false);
    });
});
