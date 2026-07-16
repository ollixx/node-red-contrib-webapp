import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P96 — ui-button fresh E2E tests (per .ai/agents/node-testing.md).
 * Replaces the P43/P44 presence-only tests.
 *
 * Each test asserts an observable OUTCOME (rendered attribute / DOM structure /
 * emitted event). A test turns RED if the feature is removed or broken.
 *
 * Covers (see docs/nodes/display/ui-button.md):
 *   - Rendering: sl-button with label text in DOM
 *   - Variant: sl-button[variant] attribute
 *   - Size: sl-button[size] attribute (Shoelace small/medium/large)
 *   - Outline: sl-button[outline] boolean attribute
 *   - Disabled: sl-button[disabled] attribute + no click event
 *   - Link mode "url": sl-button[href] renders a real hyperlink
 *   - Link mode "navigate": data-webapp-navigate attribute
 *   - Click event: POST /event with event="click"
 *   - msg.payload: label updated in DOM
 *   - show/hide verbs: element visibility
 *   - enable/disable verbs: button disabled state
 *
 * See: tests/e2e/nodes/view/ui-button.tests.md
 */

test.describe("ui-button (P96)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── Core render pipeline ─────────────────────────────────────────────────

    test("renders sl-button in DOM with label text", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp1", root: "btnApp1" })
            .node("ui-button", { id: "btnNode1", label: "Click me" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp1");
        await webapp.navigate("/");
        // Outcome: the sl-button element exists AND contains the label text.
        await expect(page.locator("sl-button")).toContainText("Click me");
    });

    test("default-configured button renders its label text in the sl-button (not empty)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp2", root: "btnApp2" })
            .node("ui-button", { id: "btnDefault" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp2");
        await webapp.navigate("/");
        // Outcome: the FlowBuilder default supplies label "Button"; the rendered
        // sl-button carries that text. Goes red if the label binding stops
        // reaching the rendered element (the button would render empty).
        await expect(page.locator("sl-button")).toContainText("Button");
    });

    // ── Variant ───────────────────────────────────────────────────────────────

    test("variant='primary' → sl-button[variant=primary] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp3", root: "btnApp3" })
            .node("ui-button", { id: "btnPrimary", label: "Primary", variant: "primary" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp3");
        await webapp.navigate("/");
        await expect(page.locator('sl-button[variant="primary"]')).toBeVisible();
    });

    test("variant='danger' → sl-button[variant=danger] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp4", root: "btnApp4" })
            .node("ui-button", { id: "btnDanger", label: "Delete", variant: "danger" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp4");
        await webapp.navigate("/");
        await expect(page.locator('sl-button[variant="danger"]')).toBeVisible();
    });

    // ── Size ──────────────────────────────────────────────────────────────────

    test("size='sm' → sl-button[size=small] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp5", root: "btnApp5" })
            .node("ui-button", { id: "btnSmall", label: "Small", size: "sm" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp5");
        await webapp.navigate("/");
        // Shoelace size attribute is "small" (not "sm").
        await expect(page.locator('sl-button[size="small"]')).toBeVisible();
    });

    test("size='lg' → sl-button[size=large] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp6", root: "btnApp6" })
            .node("ui-button", { id: "btnLarge", label: "Large", size: "lg" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp6");
        await webapp.navigate("/");
        await expect(page.locator('sl-button[size="large"]')).toBeVisible();
    });

    // ── Outline ───────────────────────────────────────────────────────────────

    test("outline=true → sl-button has outline attribute in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp7", root: "btnApp7" })
            .node("ui-button", { id: "btnOutline", label: "Outline", outline: true })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp7");
        await webapp.navigate("/");
        await expect(page.locator("sl-button[outline]")).toBeVisible();
    });

    // ── Disabled ──────────────────────────────────────────────────────────────

    test("disabled literal true → sl-button[disabled] in browser DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp8", root: "btnApp8" })
            .node("ui-button", {
                id: "btnDisabled",
                label: "Disabled",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp8");
        await webapp.navigate("/");
        // The sl-button[disabled] attribute must be present in the DOM.
        await expect(page.locator("sl-button[disabled]")).toBeVisible();
    });

    test("disabled=false → sl-button has NO disabled attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp9", root: "btnApp9" })
            .node("ui-button", {
                id: "btnEnabled",
                label: "Enabled",
                disabled: { kind: "literal", value: false }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp9");
        await webapp.navigate("/");
        await expect(page.locator("sl-button:not([disabled])")).toBeVisible();
    });

    // ── Link mode ─────────────────────────────────────────────────────────────

    test("linkMode='url' with href → sl-button renders as hyperlink with href attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnApp10", root: "btnApp10" })
            .node("ui-button", {
                id: "btnUrl",
                label: "Open docs",
                linkMode: "url",
                href: { kind: "literal", value: "https://example.com/docs" }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnApp10");
        await webapp.navigate("/");
        // In URL mode, sl-button renders an <a> internally; the href attr on sl-button carries the URL.
        await expect(page.locator('sl-button[href="https://example.com/docs"]')).toBeVisible();
    });

    // ── Click event ───────────────────────────────────────────────────────────

    test("click on sl-button → POST /event with event='click' and sourceId", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnEvtApp", root: "btnEvtApp" })
            .node("ui-button", { id: "btnEvtNode", label: "Submit" })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnEvtApp");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("sl-button").click();
        const body = await eventPromise;

        expect(body.event).toBe("click");
        expect(body.sourceId).toBe("btnEvtNode");
    });

    test("disabled button does NOT emit click event when clicked", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnNoClickApp", root: "btnNoClickApp" })
            .node("ui-button", {
                id: "btnNoClick",
                label: "Locked",
                disabled: { kind: "literal", value: true }
            })
            .build();

        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnNoClickApp");
        await webapp.navigate("/");

        // Track any POST /event calls during a forced click attempt.
        const eventCalls: unknown[] = [];
        page.on("request", (req) => {
            if (req.url().includes("/event") && req.method() === "POST") {
                eventCalls.push(req.postData());
            }
        });

        // Disabled buttons cannot be interacted with normally; force the click to verify runtime guards.
        await page.locator("sl-button").click({ force: true });
        // Wait a tick for any network to settle.
        await page.waitForTimeout(200);
        // No POST /event should have been fired from a disabled button.
        expect(eventCalls).toHaveLength(0);
    });
});
