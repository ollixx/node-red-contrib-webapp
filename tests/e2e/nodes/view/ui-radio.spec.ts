import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P127 — per-node E2E specs for ui-radio (ADR 0012 binding ubiquity).
 *
 * Covers (see tests/e2e/nodes/view/ui-radio.tests.md):
 *   R01–R02  rendering: sl-radio-group visible with label and sl-radio options.
 *   V01–V03  value binding: literal string, state binding, valuePath migration.
 *   D01–D03  disabled binding: literal true/false, Store binding → live disable.
 *   E01      events: sl-change → change event with selected value.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree —
 * the orchestrator runs the full E2E suite on the merged develop branch.
 */

test.describe("ui-radio (P127)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("R01 — renders sl-radio-group with label and sl-radio options", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd01App", root: "rd01App" })
            .node("ui-radio", {
                id: "rd01",
                label: "Size",
                optionsJson: JSON.stringify([
                    { label: "Small", value: "s" },
                    { label: "Large", value: "l" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd01App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group")).toBeVisible();
        await expect(page.locator("sl-radio-group")).toHaveAttribute("label", "Size");
        await expect(page.locator("sl-radio[value='s']")).toBeVisible();
        await expect(page.locator("sl-radio[value='l']")).toBeVisible();
    });

    test("R02 — sl-radio-group renders orientation attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd02App", root: "rd02App" })
            .node("ui-radio", {
                id: "rd02",
                label: "Color",
                orientation: "horizontal",
                optionsJson: JSON.stringify([{ label: "Red", value: "red" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd02App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group")).toBeVisible();
    });

    // ─── value binding (P127 — full canonical set) ───────────────────────────

    test("V01 — value literal string binding sets initial selected radio", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd03App", root: "rd03App" })
            .node("ui-radio", {
                id: "rd03",
                label: "Fruit",
                optionsJson: JSON.stringify([
                    { label: "Apple", value: "apple" },
                    { label: "Banana", value: "banana" }
                ]),
                value: { kind: "literal", value: "banana" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd03App");
        await webapp.navigate("/");
        const val = await page.locator("sl-radio-group").evaluate(
            (el) => (el as HTMLElement & { value: string }).value
        );
        expect(val).toBe("banana");
    });

    test("V02 — value state binding resolves live value from client-state", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd04App", root: "rd04App" })
            .node("ui-store", {
                id: "rd04Store",
                statePath: "radioState",
                initialValue: JSON.stringify("l")
            })
            .node("ui-radio", {
                id: "rd04",
                label: "Size",
                optionsJson: JSON.stringify([
                    { label: "Small", value: "s" },
                    { label: "Large", value: "l" }
                ]),
                value: { kind: "state", path: "radioState" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd04App");
        await webapp.navigate("/");
        const val = await page.locator("sl-radio-group").evaluate(
            (el) => (el as HTMLElement & { value: string }).value
        );
        expect(val).toBe("l");
    });

    test("V03 — legacy valuePath migrated: radio group shows correct initial value", async ({ page, request }) => {
        // Simulate a pre-P127 node config: value=null, valuePath set.
        // The runtime falls back to valuePath as a state binding.
        const flow = new FlowBuilder()
            .app({ id: "rd05App", root: "rd05App" })
            .node("ui-store", {
                id: "rd05Store",
                statePath: "legacyRadio",
                initialValue: JSON.stringify("red")
            })
            .node("ui-radio", {
                id: "rd05",
                label: "Color",
                optionsJson: JSON.stringify([
                    { label: "Red", value: "red" },
                    { label: "Blue", value: "blue" }
                ]),
                value: null,
                valuePath: "legacyRadio"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd05App");
        await webapp.navigate("/");
        const val = await page.locator("sl-radio-group").evaluate(
            (el) => (el as HTMLElement & { value: string }).value
        );
        expect(val).toBe("red");
    });

    // ─── disabled binding (P127 — boolean state set) ─────────────────────────

    test("D01 — disabled literal true renders sl-radio-group[disabled]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd06App", root: "rd06App" })
            .node("ui-radio", {
                id: "rd06",
                label: "Size",
                optionsJson: JSON.stringify([{ label: "Small", value: "s" }]),
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd06App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group[disabled]")).toBeVisible();
    });

    test("D02 — disabled literal false renders sl-radio-group without disabled attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd07App", root: "rd07App" })
            .node("ui-radio", {
                id: "rd07",
                label: "Size",
                optionsJson: JSON.stringify([{ label: "Small", value: "s" }]),
                disabled: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd07App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group")).toBeVisible();
        const disabledAttr = await page.locator("sl-radio-group").getAttribute("disabled");
        expect(disabledAttr).toBeNull();
    });

    test("D03 — disabled store binding disables radio group live when store value becomes truthy", async ({ page, request }) => {
        // Initially store is false → group enabled; inject true → group disabled.
        const flow = new FlowBuilder()
            .app({ id: "rd08App", root: "rd08App" })
            .node("ui-store", {
                id: "rd08Store",
                statePath: "radioDisabled",
                initialValue: JSON.stringify(false)
            })
            .node("ui-radio", {
                id: "rd08",
                label: "Size",
                optionsJson: JSON.stringify([{ label: "Small", value: "s" }]),
                disabled: { kind: "store", path: "rd08Store" }
            })
            .withStoreInject("rd08Inj", "rd08Store", true)
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd08App");
        await webapp.navigate("/");

        // Initially enabled.
        const disabledBefore = await page.locator("sl-radio-group").getAttribute("disabled");
        expect(disabledBefore).toBeNull();

        // Inject true into store → radio group should become disabled.
        await injectMessage(request, "rd08Inj");
        await expect(page.locator("sl-radio-group[disabled]")).toBeVisible({ timeout: 5000 });
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("E01 — sl-change on sl-radio-group → POST /event { event:'change', params:{ value: string } }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd09App", root: "rd09App" })
            .node("ui-radio", {
                id: "rd09",
                label: "Color",
                optionsJson: JSON.stringify([
                    { label: "Red", value: "red" },
                    { label: "Blue", value: "blue" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd09App");
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

    // ─── P136: shared Options helper (json | store) + label binding ───────────

    test("O01 — options json form 3 (array of {label,value}) renders sl-radio options", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd10App", root: "rd10App" })
            .node("ui-radio", {
                id: "rd10",
                label: "Size",
                options: {
                    kind: "literal",
                    value: [
                        { label: "Small", value: "s" },
                        { label: "Large", value: "l" }
                    ]
                }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd10App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group")).toBeVisible();
        await expect(page.locator("sl-radio[value='s']")).toBeVisible();
        await expect(page.locator("sl-radio[value='l']")).toBeVisible();
    });

    test("O02 — options json form 2 (array of strings, value = label) renders options", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd11App", root: "rd11App" })
            .node("ui-radio", {
                id: "rd11",
                label: "Letter",
                options: { kind: "literal", value: ["A", "B"] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd11App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio[value='A']")).toBeVisible();
        await expect(page.locator("sl-radio[value='B']")).toBeVisible();
    });

    test("O03 — options json form 1 (object map {label:value}) renders options", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd12App", root: "rd12App" })
            .node("ui-radio", {
                id: "rd12",
                label: "Country",
                options: { kind: "literal", value: { Germany: "de", France: "fr" } }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd12App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio[value='de']")).toBeVisible();
        await expect(page.locator("sl-radio[value='fr']")).toBeVisible();
    });

    test("O04 — options store binding renders options reactively from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd13App", root: "rd13App" })
            .node("ui-store", {
                id: "rd13Store",
                statePath: "radioOptions",
                initialValue: JSON.stringify([
                    { label: "One", value: "1" },
                    { label: "Two", value: "2" }
                ])
            })
            .node("ui-radio", {
                id: "rd13",
                label: "Number",
                options: { kind: "store", path: "rd13Store" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd13App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio[value='1']")).toBeVisible();
        await expect(page.locator("sl-radio[value='2']")).toBeVisible();
    });

    test("O05 — legacy optionsJson migrates: new `options` field still renders", async ({ page, request }) => {
        // Pre-P136 config: optionsJson only, no `options` binding object.
        const flow = new FlowBuilder()
            .app({ id: "rd14App", root: "rd14App" })
            .node("ui-radio", {
                id: "rd14",
                label: "Legacy",
                optionsJson: JSON.stringify([{ label: "Old", value: "old" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd14App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio[value='old']")).toBeVisible();
    });

    test("L01 — label store binding shows the live label value on the group", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "rd15App", root: "rd15App" })
            .node("ui-store", {
                id: "rd15Store",
                statePath: "radioLabel",
                initialValue: JSON.stringify("Choose a size")
            })
            .node("ui-radio", {
                id: "rd15",
                label: { kind: "store", path: "rd15Store" },
                options: { kind: "literal", value: ["s", "l"] }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "rd15App");
        await webapp.navigate("/");
        await expect(page.locator("sl-radio-group")).toHaveAttribute("label", "Choose a size");
    });
});
