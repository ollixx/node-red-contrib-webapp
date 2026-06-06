import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
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
