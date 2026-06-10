import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P123 — per-node E2E specs for ui-input (ADR 0012).
 *
 * Covers (see tests/e2e/nodes/view/ui-input.tests.md):
 *   R01–R05  rendering: sl-input visible, label, inputType, placeholder.
 *   V01–V03  value binding: literal, state, valuePath migration (runtime).
 *   D01–D03  disabled binding: literal true/false, Store binding → live disable.
 *   E01–E02  events: sl-change → change event, sl-submit → submit event.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree —
 * the orchestrator runs the full E2E suite on the merged develop branch.
 */

test.describe("ui-input (P123)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("R01 — renders sl-input element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp01App", root: "inp01App" })
            .node("ui-input", { id: "inp01", label: "Name" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp01App");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toBeVisible();
    });

    test("R02 — label prop sets the label attribute on sl-input", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp02App", root: "inp02App" })
            .node("ui-input", { id: "inp02", label: "Email address" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp02App");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toHaveAttribute("label", "Email address");
    });

    test("R03 — inputType=email sets type='email' on sl-input", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp03App", root: "inp03App" })
            .node("ui-input", { id: "inp03", label: "Email", inputType: "email" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp03App");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toHaveAttribute("type", "email");
    });

    test("R04 — inputType=number sets type='number' on sl-input", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp04App", root: "inp04App" })
            .node("ui-input", { id: "inp04", label: "Count", inputType: "number" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp04App");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toHaveAttribute("type", "number");
    });

    test("R05 — placeholder prop sets placeholder attribute on sl-input", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp05App", root: "inp05App" })
            .node("ui-input", { id: "inp05", label: "Search", placeholder: "Type to search..." })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp05App");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toHaveAttribute("placeholder", "Type to search...");
    });

    // ─── value binding (P123 — full canonical set) ───────────────────────────

    test("V01 — value literal binding sets initial field value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp06App", root: "inp06App" })
            .node("ui-input", {
                id: "inp06",
                label: "Prefilled",
                value: { kind: "literal", value: "hello" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp06App");
        await webapp.navigate("/");
        const val = await page.locator("sl-input").evaluate(
            (el) => (el as HTMLInputElement & { value: string }).value ?? el.getAttribute("value") ?? ""
        );
        expect(val).toBe("hello");
    });

    test("V02 — value state binding resolves live value from client-state", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp07App", root: "inp07App" })
            .node("ui-store", {
                id: "inp07Store",
                statePath: "inputState",
                initialValue: JSON.stringify("stateValue")
            })
            .node("ui-input", {
                id: "inp07",
                label: "State bound",
                value: { kind: "state", path: "inputState" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp07App");
        await webapp.navigate("/");
        const val = await page.locator("sl-input").evaluate(
            (el) => (el as HTMLInputElement & { value: string }).value ?? el.getAttribute("value") ?? ""
        );
        expect(val).toBe("stateValue");
    });

    test("V03 — legacy valuePath migrated by runtime: field shows correct initial value", async ({ page, request }) => {
        // The runtime already migrates valuePath → state binding via getBinding fallback.
        // Use a store-backed state path to have a known initial value.
        const flow = new FlowBuilder()
            .app({ id: "inp08App", root: "inp08App" })
            .node("ui-store", {
                id: "inp08Store",
                statePath: "legacyPath",
                initialValue: JSON.stringify("legacy")
            })
            .node("ui-input", {
                id: "inp08",
                label: "Legacy",
                // Simulate a pre-P123 node: value=null, valuePath set
                value: null,
                valuePath: "legacyPath"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp08App");
        await webapp.navigate("/");
        const val = await page.locator("sl-input").evaluate(
            (el) => (el as HTMLInputElement & { value: string }).value ?? el.getAttribute("value") ?? ""
        );
        expect(val).toBe("legacy");
    });

    // ─── disabled binding (P123 — boolean state set) ─────────────────────────

    test("D01 — disabled literal true renders sl-input[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp09App", root: "inp09App" })
            .node("ui-input", {
                id: "inp09",
                label: "Locked",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp09App");
        await webapp.navigate("/");
        await expect(page.locator("sl-input[disabled]")).toBeVisible();
    });

    test("D02 — disabled literal false renders sl-input without disabled attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp10App", root: "inp10App" })
            .node("ui-input", {
                id: "inp10",
                label: "Enabled",
                disabled: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp10App");
        await webapp.navigate("/");
        await expect(page.locator("sl-input")).toBeVisible();
        const disabledAttr = await page.locator("sl-input").getAttribute("disabled");
        expect(disabledAttr).toBeNull();
    });

    test("D03 — disabled store binding disables field live when store value becomes truthy", async ({ page, request }) => {
        // Initially store is false → field enabled; inject true → field disabled.
        const flow = new FlowBuilder()
            .app({ id: "inp11App", root: "inp11App" })
            .node("ui-store", {
                id: "inp11Store",
                statePath: "isDisabled",
                initialValue: JSON.stringify(false)
            })
            .node("ui-input", {
                id: "inp11",
                label: "Store disabled",
                disabled: { kind: "store", path: "inp11Store" }
            })
            .withStoreInject("inp11Inj", "inp11Store", true)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp11App");
        await webapp.navigate("/");

        // Initially enabled.
        const disabledBefore = await page.locator("sl-input").getAttribute("disabled");
        expect(disabledBefore).toBeNull();

        // Inject true into store → field should become disabled.
        await injectMessage(request, "inp11Inj");
        await expect(page.locator("sl-input[disabled]")).toBeVisible({ timeout: 5000 });
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("E01 — sl-change → POST /event { event:'change', params:{ value } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp12App", root: "inp12App" })
            .node("ui-input", { id: "inp12", label: "City" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp12App");
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

    test("E02 — sl-submit → POST /event { event:'submit', params:{ value } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "inp13App", root: "inp13App" })
            .node("ui-input", { id: "inp13", label: "Query" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "inp13App");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        await page.evaluate(() => {
            const el = document.querySelector("sl-input") as HTMLElement & { value: string };
            if (el) {
                el.value = "search term";
                el.dispatchEvent(new CustomEvent("sl-input-submit", { bubbles: true, composed: true }));
            }
        });

        const body = await eventPromise;
        expect(body.event).toBe("submit");
        expect((body.params as Record<string, unknown>).value).toBe("search term");
    });
});
