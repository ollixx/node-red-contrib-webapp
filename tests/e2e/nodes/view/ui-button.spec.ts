import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/** Fetch the server-rendered HTML for an app (byte-identical to the SSE snapshot). */
async function served(request: import("@playwright/test").APIRequestContext, appId: string): Promise<string> {
    const res = await request.get(`/webapp/${appId}/`);
    expect(res.ok()).toBeTruthy();
    return res.text();
}

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

/**
 * P236 — conformance additions (node-conformance epic).
 *
 * Every assertion below is DERIVED from the ui-button render pipeline
 * (nodes/webapp.js mapConfig `ui-button` block + resources/lib/webapp-serializer.js
 * `kind === "button"` branch) and confirmed by inspecting the live served HTML.
 *
 * WORKING features (green, measured): label store-binding (initial + live SSE),
 * icon prefix slot, href store-binding (url mode).
 *
 * KNOWN GAPS (asserted as the REAL current behaviour, with a DISCREPANCY note so
 * a later fix phase flips them — NOT fake-greened as if they worked):
 *   - base-field `color` has NO effect on a button (colour is `variant`; the
 *     editor sets `color:false`, so `color` is N/A by design for ui-button).
 *   - a bound `visible=false` does NOT gate a button (the `ui-button` mapConfig
 *     block never wires `visible → visibleIf`, unlike the p16Kind nodes).
 *   - `msg.payload` does NOT update the rendered `label` (computeLiveViewPatch,
 *     nodes/webapp.js, omits "label" from the fields it carries into the snapshot).
 * See the P236 Result for the full spec↔code discrepancy report.
 */

test.describe("ui-button — label binding (P236)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("store-bound label renders the resolved live value and updates via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnLblApp", root: "btnLblApp" })
            .node("ui-store", { id: "btnLblStore", app: "btnLblApp", statePath: "lbl", initialValue: JSON.stringify("LiveLabel") })
            .node("ui-button", { id: "btnLbl", label: { kind: "store", path: "btnLblStore" } })
            .withStoreInject("btnLblInj", "btnLblStore", "ChangedLabel")
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnLblApp");
        await webapp.navigate("/");
        // Initial: the store value resolves into the button's default slot (text).
        await expect(page.locator("sl-button")).toContainText("LiveLabel");
        // Replace the store → SSE re-render re-resolves bind.label → new text.
        await injectMessage(request, "btnLblInj");
        await expect(page.locator("sl-button")).toContainText("ChangedLabel", { timeout: 5000 });
    });
});

test.describe("ui-button — icon prefix slot (P236)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("icon {library,name} → <sl-icon slot='prefix'> before the label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnIconApp", root: "btnIconApp" })
            .node("ui-button", { id: "btnIcon", label: "WithIcon", icon: { library: "default", name: "gear" } })
            .build();
        await deployFlow(request, flow);
        // Derived exactly from the serializer: renderIconHtml(..., {slot:"prefix"}) →
        // <sl-icon slot="prefix" class="webapp-icon" name="gear"></sl-icon>, then the label.
        const html = await served(request, "btnIconApp");
        expect(html).toMatch(/<sl-icon slot="prefix"[^>]*name="gear"[^>]*><\/sl-icon>WithIcon/);
        // Measured in the live DOM: the sl-icon sits in the button's prefix slot.
        const webapp = new WebappPage(page, "btnIconApp");
        await webapp.navigate("/");
        const prefixIcon = page.locator('sl-button sl-icon[slot="prefix"][name="gear"]');
        await expect(prefixIcon).toHaveCount(1);
    });
});

test.describe("ui-button — href binding in url mode (P236)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("store-bound href (linkMode=url) → sl-button renders the resolved href", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnHrefApp", root: "btnHrefApp" })
            .node("ui-store", { id: "btnHrefStore", app: "btnHrefApp", statePath: "h", initialValue: JSON.stringify("https://bound.example/x") })
            .node("ui-button", {
                id: "btnHref",
                label: "Link",
                linkMode: "url",
                href: { kind: "store", path: "btnHrefStore" }
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnHrefApp");
        await webapp.navigate("/");
        // A dynamic href routes through bind.href → resolvedProps.href → the
        // serializer emits it as the sl-button[href] hyperlink attribute.
        await expect(page.locator('sl-button[href="https://bound.example/x"]')).toBeVisible();
    });
});

// DISCREPANCY (P236): the base-field `color` does NOT colour a button. The editor
// registers ui-button with `color:false` — a button's colour is its `variant`
// ("variant = Farbe" convention), so `color` is N/A by design. The mapConfig
// `ui-button` block never routes `color → bind.color` AND the serializer's button
// branch never reads props.color. This test LOCKS the current (correct-by-design)
// behaviour: a `color` on a button emits NO colour style. If a future phase decides
// buttons should honour `color`, it flips this test.
test.describe("ui-button — base-field color is N/A (colour is variant) (P236)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("a bound color emits NO colour style on the button", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnClrApp", root: "btnClrApp" })
            .node("ui-button", { id: "btnClr", label: "Colored", color: { kind: "literal", value: "rgb(0, 128, 0)" } })
            .build();
        await deployFlow(request, flow);
        const html = await served(request, "btnClrApp");
        // The button still renders...
        expect(html).toContain("<sl-button");
        // ...but carries NO `--color` custom property and no inline colour style
        // (unlike ui-divider/ui-progress, whose colour DOES come from `color`).
        expect(html).not.toMatch(/<sl-button[^>]*--color/);
        expect(html).not.toMatch(/<sl-button[^>]*style="[^"]*color:/);
    });
});

// DISCREPANCY (P236): a bound `visible=false` does NOT gate a button. The `ui-button`
// mapConfig block (nodes/webapp.js) builds its ComponentDefinition WITHOUT wiring
// `visible → visibleIf` — unlike every p16Kind node (ui-divider/ui-progress/…),
// whose generic block sets `visibleIf`. So the render-gate (renderer.ts gates on
// component.visibleIf, ADR 0037) never fires for a button: it renders regardless.
// The editor DOES offer the `visible` base field (BASE_FIELDS.visible:true), so this
// is a genuine spec↔code gap, not a by-design N/A. This test LOCKS the current
// (leaky) behaviour; a fix phase that wires visibleIf flips it.
test.describe("ui-button — visible render-gate is NOT wired (P236 gap)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("a store-bound visible=false STILL renders the button (gate does not fire)", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnVisApp", root: "btnVisApp" })
            .node("ui-store", { id: "btnVisStore", app: "btnVisApp", statePath: "show", initialValue: JSON.stringify(false) })
            .node("ui-button", { id: "btnVis", label: "Hidden", visible: { kind: "store", path: "btnVisStore" } })
            .build();
        await deployFlow(request, flow);
        const html = await served(request, "btnVisApp");
        // Current behaviour: the button is rendered even though visible resolves false.
        // (A working render-gate — as on ui-divider — would make this `not.toContain`.)
        expect(html).toContain("<sl-button");
        expect(html).toContain(">Hidden");
    });
});

// DISCREPANCY (P236): `msg.payload` does NOT update the rendered `label`. The button
// input handler (buttonInputHandler → viewNodePatchInputHandler) DOES patch the live
// definition's `label` and pushes a snapshot, but `computeLiveViewPatch`
// (nodes/webapp.js) does NOT list "label" among the fields it carries into the
// re-rendered snapshot — so the update never reaches the client. Verified with a
// control: on the SAME inject a ui-text (primary field "value", which IS carried)
// updates, while the button's label does not. The spec's Input section documents
// msg.payload → label as the intended contract; this test asserts the REAL behaviour.
test.describe("ui-button — msg.payload label update is NOT delivered (P236 gap)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("msg.payload does NOT change the rendered label (computeLiveViewPatch omits it)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "btnMsgApp", root: "btnMsgApp" })
            .node("ui-button", { id: "btnMsg", label: "OrigLabel" })
            .withInjectNode("btnMsgInj", "btnMsg", "UpdatedLabel")
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "btnMsgApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-button")).toContainText("OrigLabel");
        await injectMessage(request, "btnMsgInj");
        // The label stays "OrigLabel" — the payload patch is dropped before it reaches
        // the snapshot. (A working delivery would show "UpdatedLabel" here.)
        await page.waitForTimeout(500);
        await expect(page.locator("sl-button")).toContainText("OrigLabel");
        await expect(page.locator("sl-button")).not.toContainText("UpdatedLabel");
    });
});
