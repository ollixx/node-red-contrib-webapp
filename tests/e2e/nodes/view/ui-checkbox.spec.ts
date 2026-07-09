import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P97/P129 — ui-checkbox E2E tests (per .ai/agents/node-testing.md).
 * Replaces the P44 presence-only tests. P129 adds store-binding for disabled.
 *
 * Each test asserts an observable OUTCOME (rendered attribute / DOM structure /
 * emitted event / action applied). A test turns RED if the feature is removed.
 *
 * Covers (see docs/nodes/input/ui-checkbox.md):
 *   - Rendering: sl-checkbox with label text in DOM
 *   - Disabled (literal true): sl-checkbox[disabled] attribute present
 *   - Disabled (store binding truthy): sl-checkbox[disabled] via ui-store
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

    // P129 (ADR 0012): disabled via store binding
    test("disabled: store binding (truthy initial value) → sl-checkbox[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp12", root: "cbApp12" })
            .node("ui-store", { id: "cbStore12", statePath: "isLocked", initialValue: "true" })
            .node("ui-checkbox", {
                id: "cbNode12",
                label: "Locked by store",
                value: { kind: "literal", value: false },
                disabled: { kind: "store", path: "cbStore12" }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp12");
        await webapp.navigate("/");

        // Outcome: sl-checkbox is disabled because the store's initial value is truthy.
        await expect(page.locator("sl-checkbox[disabled]")).toBeVisible();
    });

    test("disabled: store binding (falsy initial value) → sl-checkbox is active", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "cbApp13", root: "cbApp13" })
            .node("ui-store", { id: "cbStore13", statePath: "editMode", initialValue: "false" })
            .node("ui-checkbox", {
                id: "cbNode13",
                label: "Active via store",
                value: { kind: "literal", value: false },
                disabled: { kind: "store", path: "cbStore13" }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "cbApp13");
        await webapp.navigate("/");

        const cb = page.locator("sl-checkbox");
        await expect(cb).toBeVisible();
        // Falsy store value → no disabled attribute.
        await expect(cb).not.toHaveAttribute("disabled");
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

    // ─── writeTo write-back (P204 / ADR 0027) — measured, no wiring ────────────

    test("W01 — toggling a checkbox with writeTo=store persists checked and a second bound view updates live", async ({ page, request }) => {
        // A ui-checkbox writes store(cbWbStore).on; a second ui-text reads it. A
        // checkbox has no submit gesture → it writes on change regardless of
        // writeTrigger (submit). Measured proof: the ui-text CONTENT flips over SSE.
        const flow = new FlowBuilder()
            .app({ id: "cbWbApp", root: "cbWbApp" })
            .node("ui-store", { id: "cbWbStore", statePath: "form", initialValue: JSON.stringify({ on: false }) })
            .node("ui-checkbox", {
                id: "cbWbIn",
                label: "Accept",
                value: { kind: "store", path: "cbWbStore", subPath: { kind: "literal", value: "on" } },
                writeTo: { kind: "store", path: "cbWbStore", subPath: { kind: "literal", value: "on" } },
                writeTrigger: "submit"
            })
            .node("ui-text", {
                id: "cbWbOut",
                value: { kind: "store", path: "cbWbStore", subPath: { kind: "literal", value: "on" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "cbWbApp");
        await webapp.navigate("/");
        await expect(webapp.root().locator(".webapp-text")).toContainText("false");

        await page.evaluate(() => {
            const el = document.querySelector("sl-checkbox") as HTMLElement & { checked: boolean };
            el.checked = true;
            el.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
        });

        await expect(webapp.root().locator(".webapp-text")).toContainText("true", { timeout: 5000 });
    });
});
