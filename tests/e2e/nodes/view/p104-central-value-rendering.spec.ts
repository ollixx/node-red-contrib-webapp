import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P104 — central display-value normalization, proven in the live browser.
 *
 * One rule, applied centrally (docs/nodes/concepts/value-rendering.md §1), governs
 * how every value-binding display node renders a bound value. These outcome tests
 * deploy a real flow, open the app, and read the DOM text:
 *
 *   0      → "0"     (falsy-but-valid number)
 *   false  → "false" (falsy-but-valid boolean)
 *   ""     → ""      (element rendered, no content)
 *   null   → "?"     (not displayable)
 *   {}/[]  → "?"     (non-scalar — never [object Object])
 *
 * See: tests/e2e/nodes/view/p104-central-value-rendering.tests.md
 */

test.describe("P104 central value rendering (ui-text)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("0 renders as \"0\" (falsy number is a valid value)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104t1", root: "p104t1" })
            .node("ui-text", { id: "t1", value: { kind: "literal", value: 0 } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104t1").navigate("/");
        await expect(page.locator(".webapp-text").first()).toHaveText("0");
    });

    test("false renders as \"false\"", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104t2", root: "p104t2" })
            .node("ui-text", { id: "t2", value: { kind: "literal", value: false } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104t2").navigate("/");
        await expect(page.locator(".webapp-text").first()).toHaveText("false");
    });

    test("empty string renders as empty content (no \"?\")", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104t3", root: "p104t3" })
            .node("ui-text", { id: "t3", value: { kind: "literal", value: "" } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104t3").navigate("/");
        await expect(page.locator(".webapp-text").first()).toHaveText("");
    });

    test("null renders the \"?\" non-displayable sentinel", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104t4", root: "p104t4" })
            .node("ui-text", { id: "t4", value: { kind: "literal", value: null } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104t4").navigate("/");
        await expect(page.locator(".webapp-text").first()).toHaveText("?");
    });

    test("an object never leaks as [object Object] — renders \"?\"", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104t5", root: "p104t5" })
            .node("ui-text", { id: "t5", value: { kind: "literal", value: { foo: "bar" } } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104t5").navigate("/");
        const text = page.locator(".webapp-text").first();
        await expect(text).toHaveText("?");
        await expect(text).not.toContainText("[object Object]");
    });

    test("an array renders \"?\"", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104t6", root: "p104t6" })
            .node("ui-text", { id: "t6", value: { kind: "literal", value: [1, 2, 3] } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104t6").navigate("/");
        await expect(page.locator(".webapp-text").first()).toHaveText("?");
    });
});

test.describe("P104 central value rendering (ui-badge)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("0 renders as \"0\" inside sl-badge", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104b1", root: "p104b1" })
            .node("ui-badge", { id: "b1", value: { kind: "literal", value: 0 } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104b1").navigate("/");
        await expect(page.locator("sl-badge")).toHaveText("0");
    });

    test("false renders as \"false\" inside sl-badge", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104b2", root: "p104b2" })
            .node("ui-badge", { id: "b2", value: { kind: "literal", value: false } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104b2").navigate("/");
        await expect(page.locator("sl-badge")).toHaveText("false");
    });

    test("null renders \"?\" inside sl-badge", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104b3", root: "p104b3" })
            .node("ui-badge", { id: "b3", value: { kind: "literal", value: null } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104b3").navigate("/");
        await expect(page.locator("sl-badge")).toHaveText("?");
    });

    test("an object renders \"?\" — never [object Object]", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "p104b4", root: "p104b4" })
            .node("ui-badge", { id: "b4", value: { kind: "literal", value: { a: 1 } } })
            .build();
        await deployFlow(request, flow);
        await new WebappPage(page, "p104b4").navigate("/");
        const badge = page.locator("sl-badge");
        await expect(badge).toHaveText("?");
        await expect(badge).not.toContainText("[object Object]");
    });
});
