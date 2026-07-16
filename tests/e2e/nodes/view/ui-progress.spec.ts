import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P43 — per-node E2E specs for ui-progress (stateless view node).
 *
 * Covers:
 *   1. Renders the correct Shoelace element (sl-progress-bar).
 *   2. value binding (literal) maps to the progress bar value attribute.
 *   3. label prop maps to the label attribute.
 *   4. Default/empty state: value attribute defaults to 0.
 *
 * The value field must be a binding object (e.g. { kind: "literal", value: 75 })
 * for it to survive Zod schema validation and reach the serializer.
 */

test.describe("ui-progress (P43)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders sl-progress-bar element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "progressApp1", root: "progressApp1" })
            .node("ui-progress", { id: "progressNode1", value: { kind: "literal", value: 50 } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "progressApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-progress-bar")).toBeVisible();
    });

    test("value binding maps to sl-progress-bar value attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "progressApp2", root: "progressApp2" })
            .node("ui-progress", { id: "progressNode2", value: { kind: "literal", value: 75 } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "progressApp2");
        await webapp.navigate("/");
        // Check via evaluate since Shoelace web components may reflect differently.
        const value = await page.locator("sl-progress-bar").evaluate((el) => el.getAttribute("value") ?? String(el.value ?? ""));
        expect(value).toBe("75");
    });

    test("label prop maps to sl-progress-bar label attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "progressApp3", root: "progressApp3" })
            .node("ui-progress", { id: "progressNode3", value: { kind: "literal", value: 30 }, label: "Loading..." })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "progressApp3");
        await webapp.navigate("/");
        const label = await page.locator("sl-progress-bar").evaluate((el) => el.getAttribute("label") ?? el.label ?? "");
        expect(label).toBe("Loading...");
    });

    test("default state (no value) → sl-progress-bar value defaults to 0", async ({ page, request }) => {
        // value is optional in the schema — omitting it is valid; the serializer
        // emits value="0" as the documented default. Outcome: the rendered value
        // attribute is exactly "0" (goes red if the default is dropped/changed).
        const flow = new FlowBuilder()
            .app({ id: "progressApp4", root: "progressApp4" })
            .node("ui-progress", { id: "progressNode4" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "progressApp4");
        await webapp.navigate("/");
        const value = await page
            .locator("sl-progress-bar")
            .evaluate((el) => el.getAttribute("value") ?? String((el as unknown as { value?: unknown }).value ?? ""));
        expect(value).toBe("0");
    });
});
