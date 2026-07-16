import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P225 — ui-alert: Duration is a declarative `visible=false` state transition
 * (ADR 0037). Fresh per-node tests (node-testing.md: per-node-phase → discard the
 * node's old tests). Outcome-based, mutation-red.
 *
 * Covered (baseline retained — still-valid rendering/editor contract):
 *   1.  severity → correct sl-alert variant.
 *   2.  message literal rendered as content.
 *   3-6. icon='auto' → severity-appropriate sl-icon.
 *   7.  icon='none' → no sl-icon.
 *   8.  icon absent → no sl-icon.
 *   9.  explicit icon name → sl-icon[name].
 *  10.  dismissible → closable attribute.
 *  11.  title binding → <strong>.
 *  14-15. Editor: countdown/duration cross-field validation.
 *  16-17. Editor: Title-above-Message + separator <hr>.
 *  18-19. Editor: Icon 'custom' option + picker row.
 *  P223. visible=msg toggles the alert on/off.
 *
 * P225 new (Duration as a value transition):
 *  D1. duration → after elapse the alert is REMOVED from the DOM (a real
 *      visible=false transition, not a Shoelace-only close: a hidden-but-present
 *      element would be the old autoDismissed hack). (acceptance #1, #2, #5)
 *  D2. countdown=true + duration → countdown="ltr" bar runs, then the alert is
 *      removed via the same value transition. (acceptance #4)
 *  D3. re-triggerable — after the duration hide, writing visible=true again
 *      (msg.ui.dynamicState) re-shows the alert, no reload. (acceptance #3, #5)
 */

test.describe("ui-alert (P225)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── P90 baseline ─────────────────────────────────────────────────────────

    test("severity 'warning' → sl-alert variant='warning'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp1", root: "alApp1" })
            .node("ui-alert", {
                id: "alNode1",
                message: { kind: "literal", value: "Watch out" },
                severity: "warning"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp1");
        await webapp.navigate("/");
        const variant = await page.locator("sl-alert").getAttribute("variant");
        expect(variant).toBe("warning");
    });

    test("message literal is rendered as alert content", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp2", root: "alApp2" })
            .node("ui-alert", {
                id: "alNode2",
                message: { kind: "literal", value: "Alert content text" },
                severity: "info"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert")).toContainText("Alert content text");
    });

    test("icon='auto' + severity='warning' → sl-icon name='exclamation-triangle'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp3", root: "alApp3" })
            .node("ui-alert", {
                id: "alNode3",
                message: { kind: "literal", value: "Warning!" },
                severity: "warning",
                icon: "auto"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp3");
        await webapp.navigate("/");
        const iconSlot = page.locator("sl-alert sl-icon[slot='icon']");
        await expect(iconSlot).toBeVisible();
        expect(await iconSlot.getAttribute("name")).toBe("exclamation-triangle");
    });

    test("icon='auto' + severity='success' → sl-icon name='check-circle'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp4", root: "alApp4" })
            .node("ui-alert", {
                id: "alNode4",
                message: { kind: "literal", value: "Done!" },
                severity: "success",
                icon: "auto"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp4");
        await webapp.navigate("/");
        const iconSlot = page.locator("sl-alert sl-icon[slot='icon']");
        await expect(iconSlot).toBeVisible();
        expect(await iconSlot.getAttribute("name")).toBe("check-circle");
    });

    test("icon='auto' + severity='danger' → sl-icon name='x-circle'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp5", root: "alApp5" })
            .node("ui-alert", {
                id: "alNode5",
                message: { kind: "literal", value: "Error!" },
                severity: "danger",
                icon: "auto"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp5");
        await webapp.navigate("/");
        const iconSlot = page.locator("sl-alert sl-icon[slot='icon']");
        await expect(iconSlot).toBeVisible();
        expect(await iconSlot.getAttribute("name")).toBe("x-circle");
    });

    test("icon='auto' + severity='info' → sl-icon name='info-circle'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp6", root: "alApp6" })
            .node("ui-alert", {
                id: "alNode6",
                message: { kind: "literal", value: "FYI" },
                severity: "info",
                icon: "auto"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp6");
        await webapp.navigate("/");
        const iconSlot = page.locator("sl-alert sl-icon[slot='icon']");
        await expect(iconSlot).toBeVisible();
        expect(await iconSlot.getAttribute("name")).toBe("info-circle");
    });

    test("icon='none' → no sl-icon regardless of severity", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp7", root: "alApp7" })
            .node("ui-alert", {
                id: "alNode7",
                message: { kind: "literal", value: "No icon" },
                severity: "warning",
                icon: "none"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp7");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert")).toBeVisible();
        await expect(page.locator("sl-alert sl-icon")).not.toBeVisible();
    });

    test("icon absent (default) → no sl-icon element", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp8", root: "alApp8" })
            .node("ui-alert", {
                id: "alNode8",
                message: { kind: "literal", value: "Default no icon" },
                severity: "info"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp8");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert")).toBeVisible();
        await expect(page.locator("sl-alert sl-icon")).not.toBeVisible();
    });

    test("explicit icon='bell' → sl-icon name='bell'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp9", root: "alApp9" })
            .node("ui-alert", {
                id: "alNode9",
                message: { kind: "literal", value: "Bell alert" },
                severity: "primary",
                icon: "bell"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp9");
        await webapp.navigate("/");
        const iconSlot = page.locator("sl-alert sl-icon[slot='icon']");
        await expect(iconSlot).toBeVisible();
        expect(await iconSlot.getAttribute("name")).toBe("bell");
    });

    test("dismissible=true → sl-alert has closable attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp10", root: "alApp10" })
            .node("ui-alert", {
                id: "alNode10",
                message: { kind: "literal", value: "Closable alert" },
                severity: "info",
                dismissible: true
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp10");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert")).toBeVisible();
        const hasClosable = await page.locator("sl-alert").evaluate((el) => el.hasAttribute("closable"));
        expect(hasClosable).toBe(true);
    });

    test("title binding renders as <strong> inside sl-alert", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp11", root: "alApp11" })
            .node("ui-alert", {
                id: "alApp11n",
                message: { kind: "literal", value: "Body text" },
                title: { kind: "literal", value: "Alert Title" },
                severity: "info"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp11");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert strong")).toContainText("Alert Title");
    });

    // ── P225: duration as a declarative visible=false value transition ─────────

    test("D1 duration → after elapse the alert is REMOVED from the DOM (value transition, not a Shoelace-only close)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp12", root: "alApp12" })
            .node("ui-alert", {
                id: "alNode12",
                message: { kind: "literal", value: "I will disappear" },
                severity: "info",
                duration: 2000
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp12");
        await webapp.navigate("/");
        // Initially visible.
        await expect(page.locator("sl-alert")).toBeVisible();
        // After the duration, the alert's ONE visibility value becomes false, so the
        // server re-renders that region omitting the alert and the morph removes it:
        // the element is DETACHED (count 0), not merely open=false-but-present. A revert to the old
        // client-side autoDismissed close would leave the element in the DOM → red.
        await expect(page.locator("sl-alert")).toHaveCount(0, { timeout: 6000 });
    });

    test("D2 countdown=true + duration → countdown='ltr' bar runs, then the alert is removed via the value transition", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp13", root: "alApp13" })
            .node("ui-alert", {
                id: "alNode13",
                message: { kind: "literal", value: "Counting down" },
                severity: "warning",
                duration: 2500,
                countdown: true
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp13");
        await webapp.navigate("/");
        await expect(page.locator("sl-alert")).toBeVisible();
        // The P100 countdown bar still runs: Shoelace countdown="ltr" is active.
        await expect(page.locator("sl-alert")).toHaveAttribute("countdown", "ltr", { timeout: 3000 });
        // After the countdown depletes, the hide is a value transition → the alert
        // is removed from the DOM.
        await expect(page.locator("sl-alert")).toHaveCount(0, { timeout: 7000 });
    });

    test("D3 re-triggerable — after the duration hide, writing visible=true re-shows the alert (no reload)", async ({ page, request }) => {
        // Alert with a duration + a button that re-shows it by writing the ONE
        // visibility value back to true (msg.ui.dynamicState, the P224 seam). The
        // button click carries this client's id, so the re-show is per-client —
        // exactly the write path the duration hide used to set it false.
        const flow = new FlowBuilder()
            .app({ id: "alApp14", root: "alApp14" })
            .node("ui-alert", {
                id: "alNode14",
                message: { kind: "literal", value: "Re-show me" },
                severity: "info",
                duration: 2000
            })
            .node("ui-button", {
                id: "alReshowBtn",
                label: "Show again",
                wires: [["alReshowFn"]]
            })
            .build();
        flow.push({
            type: "function",
            id: "alReshowFn",
            name: "reshow alert",
            func: "msg.ui = msg.ui || {}; msg.ui.dynamicState = { field: 'visible', value: true, id: 'alNode14' }; return msg;",
            outputs: 1,
            noerr: 0,
            z: "e2e-flow",
            x: 400,
            y: 200,
            wires: [["alNode14"]]
        });
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "alApp14");
        await webapp.navigate("/");

        // Shown, then auto-hidden by the duration value transition (removed).
        await expect(page.locator("sl-alert")).toBeVisible();
        await expect(page.locator("sl-alert")).toHaveCount(0, { timeout: 6000 });

        // Writing visible=true again re-shows the alert — no reload.
        await page.getByRole("button", { name: "Show again" }).click();
        await expect(page.locator("sl-alert")).toBeVisible({ timeout: 6000 });
        await expect(page.locator("sl-alert")).toContainText("Re-show me");
    });

    // ── P100 new: editor validation ──────────────────────────────────────────

    test("editor: countdown ON without duration → node invalid", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp15", root: "alApp15" })
            .node("ui-alert", {
                id: "alNode15",
                message: { kind: "literal", value: "Bad config" },
                severity: "info",
                countdown: true
                // no duration — must fail validation
            })
            .build();
        await deployFlow(request, flow);
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alNode15");
        expect(await editor.getValidationState("alNode15")).toBe("invalid");
    });

    test("editor: countdown ON + duration set → node valid", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp16", root: "alApp16" })
            .node("ui-alert", {
                id: "alNode16",
                message: { kind: "literal", value: "Good config" },
                severity: "info",
                countdown: true,
                duration: 3000
            })
            .build();
        await deployFlow(request, flow);
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alNode16");
        expect(await editor.getValidationState("alNode16")).toBe("valid");
    });

    // ── P100 new: editor field order ─────────────────────────────────────────

    test("editor: Title field appears above Message field", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp17", root: "alApp17" })
            .node("ui-alert", {
                id: "alNode17",
                message: { kind: "literal", value: "Order test" },
                severity: "info"
            })
            .build();
        await deployFlow(request, flow);
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alNode17");

        const titleY = await page.locator(".form-row:has(label[for='node-input-titleBinding'])").evaluate(
            (el) => (el as HTMLElement).getBoundingClientRect().top
        );
        const messageY = await page.locator(".form-row:has(label[for='node-input-messageBinding'])").evaluate(
            (el) => (el as HTMLElement).getBoundingClientRect().top
        );
        expect(titleY).toBeLessThan(messageY);
    });

    test("editor: separator <hr> appears directly after Message row", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp18", root: "alApp18" })
            .node("ui-alert", {
                id: "alNode18",
                message: { kind: "literal", value: "Separator test" },
                severity: "info"
            })
            .build();
        await deployFlow(request, flow);
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alNode18");

        const hasHrAfterMessage = await page.evaluate(() => {
            const messageRow = document.querySelector(".form-row:has(label[for='node-input-messageBinding'])");
            if (!messageRow) { return false; }
            const next = messageRow.nextElementSibling;
            return next !== null && next.tagName.toLowerCase() === "hr";
        });
        expect(hasHrAfterMessage).toBe(true);
    });

    // ── P100 new: editor icon Custom option ───────────────────────────────────

    test("editor: icon select has 'custom' option and removes nonsensical double empty/none", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp19", root: "alApp19" })
            .node("ui-alert", {
                id: "alNode19",
                message: { kind: "literal", value: "Icon options test" },
                severity: "info"
            })
            .build();
        await deployFlow(request, flow);
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alNode19");

        const values = await editor.selectOptionValues("icon");
        expect(values).toContain("custom");
        expect(values).toContain("auto");
        // The nonsensical double no-icon options ('none' AND '') must not both be present
        const hasNone = values.includes("none");
        const hasEmpty = values.includes("");
        expect(hasNone && hasEmpty).toBe(false);
    });

    test("editor: selecting 'custom' reveals the icon picker button row", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp20", root: "alApp20" })
            .node("ui-alert", {
                id: "alNode20",
                message: { kind: "literal", value: "Custom icon test" },
                severity: "info"
            })
            .build();
        await deployFlow(request, flow);
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("alNode20");

        await page.locator("#node-input-icon").selectOption("custom");
        await expect(page.locator("#node-input-icon-custom-row")).toBeVisible();
    });

    // ── P223 (ADR 0036): Message mode drives the `visible` base field ─────────
    //
    // Owner bug: `ui-alert.visible = msg.<prop>` was inert — the message-mode
    // push only ever updated the primary field (`message`). Now EVERY msg-bound
    // field is driven, so an incoming message toggles the alert's visibility.
    // (The msg path is configurable; here it reads `payload`, driven by an inject.)

    test("visible = msg: an incoming message toggles the alert on and off", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp21", root: "alApp21" })
            .node("ui-alert", {
                id: "alNode21",
                message: { kind: "literal", value: "Toggle me" },
                severity: "info",
                visible: { kind: "msg", path: "payload" }
            })
            // Two inject nodes wired to the alert: one pushes `true` (show), the
            // other `false` (hide). Boolean payloads exercise the boolean coercion.
            .withInjectNode("alShow21", "alNode21", true)
            .withInjectNode("alHide21", "alNode21", false)
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "alApp21");
        await webapp.navigate("/");

        // Default: no message yet → a `msg` visible binding resolves false →
        // the alert is not shown (DOM-absent or hidden — both satisfy toBeHidden).
        await expect(page.locator("sl-alert")).toBeHidden();

        // msg → true: the alert appears.
        await injectMessage(request, "alShow21");
        await expect(page.locator("sl-alert")).toBeVisible();
        await expect(page.locator("sl-alert")).toContainText("Toggle me");

        // msg → false: the alert is hidden again (the owner's exact scenario).
        await injectMessage(request, "alHide21");
        await expect(page.locator("sl-alert")).toBeHidden();
    });
});
