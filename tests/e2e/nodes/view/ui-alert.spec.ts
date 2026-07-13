import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P100 — ui-alert: Duration/Countdown im Frontend, Icon-Custom-Option,
 * Editor-Reihenfolge + Validierung.
 *
 * Replaces P90 tests (node-testing.md: per-node-phase → fresh tests).
 * Tests follow .ai/agents/node-testing.md: outcome-based, mutation-red.
 *
 * Covered (P90 baseline retained):
 *   1.  severity → correct sl-alert variant.
 *   2.  message literal rendered as content.
 *   3-6. icon='auto' → severity-appropriate sl-icon.
 *   7.  icon='none' → no sl-icon.
 *   8.  icon absent → no sl-icon.
 *   9.  explicit icon name → sl-icon[name].
 *  10.  dismissible → closable attribute.
 *  11.  title binding → <strong>.
 *
 * P100 new:
 *  12. duration=2000 → alert auto-hides within ~3 s (acceptance #1).
 *  13. countdown=true + duration → countdown="ltr" attr present, alert hides (acceptance #2).
 *  14. Editor: countdown ON without duration → node invalid (acceptance #3).
 *  15. Editor: countdown + duration set → node valid.
 *  16. Editor: Title field appears above Message field (acceptance #4).
 *  17. Editor: separator <hr> appears directly after Message row (acceptance #4).
 *  18. Editor: Icon select has 'custom' option, no double empty/none (acceptance #5).
 *  19. Editor: selecting 'custom' reveals the icon picker button row (acceptance #5).
 */

test.describe("ui-alert (P100)", () => {
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

    // ── P100 new: duration + countdown in the browser ─────────────────────────

    test("duration=2000 → alert auto-hides within ~3 s", async ({ page, request }) => {
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
        // Initially visible
        await expect(page.locator("sl-alert")).toBeVisible();
        // After duration + grace period, the alert must be hidden (sl-alert.open = false)
        await page.waitForFunction(
            () => {
                const el = document.querySelector("sl-alert");
                if (!el) { return true; }
                const slEl = el as HTMLElement & { open?: boolean };
                return slEl.open === false || !el.hasAttribute("open") || el.hasAttribute("hidden");
            },
            { timeout: 5000 }
        );
        const isOpen = await page.locator("sl-alert").evaluate((el) => {
            const slEl = el as HTMLElement & { open?: boolean };
            return slEl.open !== false && el.hasAttribute("open") && !el.hasAttribute("hidden");
        });
        expect(isOpen).toBe(false);
    });

    test("countdown=true + duration → countdown='ltr' attribute present and alert hides after countdown", async ({ page, request }) => {
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
        // Shoelace countdown="ltr" attribute must be present (bar depletes left-to-right)
        expect(await page.locator("sl-alert").getAttribute("countdown")).toBe("ltr");
        // Wait for auto-hide after countdown depletes
        await page.waitForFunction(
            () => {
                const el = document.querySelector("sl-alert");
                if (!el) { return true; }
                const slEl = el as HTMLElement & { open?: boolean };
                return slEl.open === false || !el.hasAttribute("open");
            },
            { timeout: 6000 }
        );
        const isHidden = await page.locator("sl-alert").evaluate((el) => {
            const slEl = el as HTMLElement & { open?: boolean };
            return slEl.open === false || !el.hasAttribute("open");
        });
        expect(isHidden).toBe(true);
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
