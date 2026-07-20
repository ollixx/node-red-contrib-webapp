import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-stepper (composite node).
 *
 * Covers:
 *   - Steps render with labels inside .webapp-stepper.
 *   - Active step has webapp-step--active class.
 *   - Step click → POST /event { event:"change", params:{ value: stepIndex } }.
 */

test.describe("ui-stepper (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("steps render as buttons with labels inside .webapp-stepper", async ({ page, request }) => {
        // Pass steps as a JSON array string — parseJsonList handles it correctly.
        const steps = JSON.stringify([
            { id: "step-1", label: "Configure" },
            { id: "step-2", label: "Review" },
            { id: "step-3", label: "Deploy" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "stpApp1", root: "stpApp1" })
            .node("ui-stepper", { id: "stpNode1", steps })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stpApp1");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-stepper")).toBeVisible();
        const stepButtons = page.locator(".webapp-stepper button.webapp-step");
        await expect(stepButtons).toHaveCount(3);
        await expect(stepButtons.nth(0)).toContainText("Configure");
        await expect(stepButtons.nth(1)).toContainText("Review");
        await expect(stepButtons.nth(2)).toContainText("Deploy");
    });

    test("active step (index 0 by default) has webapp-step--active class", async ({ page, request }) => {
        const steps = JSON.stringify([
            { id: "s1", label: "Step 1" },
            { id: "s2", label: "Step 2" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "stpApp2", root: "stpApp2" })
            .node("ui-stepper", { id: "stpNode2", steps })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stpApp2");
        await webapp.navigate("/");

        // Default activeStep is 0, so the first step should have the active class.
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(0)).toHaveClass(/webapp-step--active/);
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(1)).not.toHaveClass(/webapp-step--active/);
    });

    test("configured activeStep highlights the correct step", async ({ page, request }) => {
        const steps = JSON.stringify([
            { id: "s1", label: "Step 1" },
            { id: "s2", label: "Step 2" },
            { id: "s3", label: "Step 3" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "stpApp3", root: "stpApp3" })
            .node("ui-stepper", { id: "stpNode3", steps, activeStep: { kind: "literal", value: 1 } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stpApp3");
        await webapp.navigate("/");

        // activeStep=1 means the second step (index 1) is active.
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(1)).toHaveClass(/webapp-step--active/);
    });

    test("orientation horizontal vs vertical: distinct class + measured layout axis", async ({ page, request }) => {
        // P251: `orientation` (editor field) → `variant` (schema, via mapConfig
        // `variant: config.orientation`) → serializer renders the wrapper class
        // `webapp-stepper--<orientation>`. Prove it is observable: the class differs
        // AND the step buttons lay out along the matching axis (row vs column).
        const steps = JSON.stringify([
            { id: "a", label: "Alpha" },
            { id: "b", label: "Beta" },
            { id: "c", label: "Gamma" }
        ]);

        // Horizontal stepper.
        const hFlow = new FlowBuilder()
            .app({ id: "stpHApp", root: "stpHApp" })
            .node("ui-stepper", { id: "stpHNode", steps, orientation: "horizontal" })
            .build();
        await deployFlow(request, hFlow);

        let webapp = new WebappPage(page, "stpHApp");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-stepper")).toHaveClass(/webapp-stepper--horizontal/);

        const hBtn0 = await page.locator(".webapp-stepper button.webapp-step").nth(0).boundingBox();
        const hBtn1 = await page.locator(".webapp-stepper button.webapp-step").nth(1).boundingBox();
        // Horizontal: second button is to the RIGHT of the first (x advances),
        // and they share (roughly) the same top edge.
        expect(hBtn0).not.toBeNull();
        expect(hBtn1).not.toBeNull();
        expect(hBtn1!.x).toBeGreaterThan(hBtn0!.x + hBtn0!.width / 2);
        expect(Math.abs(hBtn1!.y - hBtn0!.y)).toBeLessThan(hBtn0!.height);

        await resetFlow(request);

        // Vertical stepper.
        const vFlow = new FlowBuilder()
            .app({ id: "stpVApp", root: "stpVApp" })
            .node("ui-stepper", { id: "stpVNode", steps, orientation: "vertical" })
            .build();
        await deployFlow(request, vFlow);

        webapp = new WebappPage(page, "stpVApp");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-stepper")).toHaveClass(/webapp-stepper--vertical/);

        const vBtn0 = await page.locator(".webapp-stepper button.webapp-step").nth(0).boundingBox();
        const vBtn1 = await page.locator(".webapp-stepper button.webapp-step").nth(1).boundingBox();
        // Vertical: second button is BELOW the first (y advances), and they share
        // (roughly) the same left edge.
        expect(vBtn0).not.toBeNull();
        expect(vBtn1).not.toBeNull();
        expect(vBtn1!.y).toBeGreaterThan(vBtn0!.y + vBtn0!.height / 2);
        expect(Math.abs(vBtn1!.x - vBtn0!.x)).toBeLessThan(vBtn0!.width);
    });

    test("step click → POST /event with event='change' and params.value = step index", async ({ page, request }) => {
        const steps = JSON.stringify([
            { id: "s1", label: "First" },
            { id: "s2", label: "Second" },
            { id: "s3", label: "Third" }
        ]);

        const flow = new FlowBuilder()
            .app({ id: "stpApp4", root: "stpApp4" })
            .node("ui-stepper", {
                id: "stpNode4",
                steps,
                events: JSON.stringify(["change"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stpApp4");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        // Click the third step (index 2).
        await page.locator(".webapp-stepper button.webapp-step").nth(2).click();

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe(2);
    });
});

/**
 * P156 (ADR 0012) — ui-stepper field-typing wave 2.
 *
 * `activeStepPath` → `activeStep` (TWO-WAY value typedInput: reads the active step
 * from a bound Store/state AND, on step change, emits the `change` event carrying
 * the chosen step index so a wired flow writes it back to that store). Mirrors the
 * P155 ui-tabs `activeTab` and P154 ui-pagination `currentPage` pattern.
 *
 * Covers:
 *   A03  two-way write-back: step click → change event → wired store set → SSE
 *        re-render activates the chosen step.
 *   A04  external store change → SSE re-render activates the step.
 *   E01  change event: step click emits change with params.value = step index.
 *   M01  migration: a legacy activeStepPath plain path still resolves.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree — the
 * orchestrator runs the full E2E suite on the merged develop branch.
 */
test.describe("ui-stepper (P156 — activeStep two-way)", () => {
    const STEPS = JSON.stringify([
        { id: "s1", label: "Step 1" },
        { id: "s2", label: "Step 2" },
        { id: "s3", label: "Step 3" }
    ]);

    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("A03 — two-way write-back: step click → change event → wired store set → active step moves", async ({ page, request }) => {
        // A function node converts the stepper `change` event into a store `set` of
        // wizard.step = params.value (the documented store-roundtrip wiring). The
        // stepper's activeStep binding reads the SAME store slice, so the SSE
        // re-render activates the chosen step — the two-way loop closes.
        const writeBackFnId = "stp156A3Fn";
        const flow = new FlowBuilder()
            .app({ id: "stp156A3App", root: "stp156A3App" })
            .node("ui-store", {
                id: "stp156A3Store",
                statePath: "wizard",
                initialValue: JSON.stringify({ step: 0 })
            })
            .node("ui-stepper", {
                id: "stp156A3",
                steps: STEPS,
                activeStep: { kind: "state", path: "wizard.step" },
                events: JSON.stringify(["change"]),
                wires: [[writeBackFnId]]
            })
            .build();

        flow.push({
            type: "function",
            id: writeBackFnId,
            name: writeBackFnId,
            func: 'msg.ui = { store: { id: "stp156A3Store", op: "set", path: "step", value: msg.ui.params.value } }; return msg;',
            outputs: 1,
            z: flow[0].id,
            x: 400,
            y: 420,
            wires: [["stp156A3Store"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stp156A3App");
        await webapp.navigate("/");
        // Default active step is index 0.
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(0)).toHaveClass(/webapp-step--active/);

        // Click the third step (index 2) → change event → function → store set → SSE.
        await page.locator(".webapp-stepper button.webapp-step").nth(2).click();

        await expect(page.locator(".webapp-stepper button.webapp-step").nth(2))
            .toHaveClass(/webapp-step--active/, { timeout: 5000 });
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(0))
            .not.toHaveClass(/webapp-step--active/);
    });

    test("A04 — external store change → SSE re-render activates the step", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "stp156A4App", root: "stp156A4App" })
            .node("ui-store", {
                id: "stp156A4Store",
                statePath: "wizard",
                initialValue: JSON.stringify({ step: 0 })
            })
            .node("ui-stepper", {
                id: "stp156A4",
                steps: STEPS,
                activeStep: { kind: "state", path: "wizard.step" }
            })
            .withStoreInject("stp156A4Inj", "stp156A4Store", { step: 1 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stp156A4App");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(0)).toHaveClass(/webapp-step--active/);

        await injectMessage(request, "stp156A4Inj");
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(1))
            .toHaveClass(/webapp-step--active/, { timeout: 5000 });
    });

    test("E01 — step click → POST /event { event:'change', params.value = step index }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "stp156E1App", root: "stp156E1App" })
            .node("ui-stepper", {
                id: "stp156E1",
                steps: STEPS,
                events: JSON.stringify(["change"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stp156E1App");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator(".webapp-stepper button.webapp-step").nth(1).click();

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe(1);
    });

    test("M01 — legacy activeStepPath migrated: active step read from the store", async ({ page, request }) => {
        // Simulate a pre-P156 flow: a plain-string path, no binding object.
        const flow = new FlowBuilder()
            .app({ id: "stp156M1App", root: "stp156M1App" })
            .node("ui-store", {
                id: "stp156M1Store",
                statePath: "wizard",
                initialValue: JSON.stringify({ step: 2 })
            })
            .node("ui-stepper", {
                id: "stp156M1",
                steps: STEPS,
                activeStepPath: "wizard.step"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "stp156M1App");
        await webapp.navigate("/");
        // the legacy path migrates to a state binding → step index 2 active.
        await expect(page.locator(".webapp-stepper button.webapp-step").nth(2)).toHaveClass(/webapp-step--active/);
    });
});
