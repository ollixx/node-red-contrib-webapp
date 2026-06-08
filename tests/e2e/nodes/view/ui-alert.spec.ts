import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P90 — ui-alert: icon field + icon logic (replaces P43 presence-only tests).
 *
 * Tests follow .ai/agents/node-testing.md: outcome-based, mutation-red.
 *
 * Covered:
 *   1. Renders sl-alert with correct Shoelace variant per severity.
 *   2. Message literal is rendered as alert content.
 *   3. icon="auto" + severity="warning" → sl-icon name="exclamation-triangle" in icon slot.
 *   4. icon="auto" + severity="success" → sl-icon name="check-circle" in icon slot.
 *   5. icon="auto" + severity="danger" → sl-icon name="x-circle" in icon slot.
 *   6. icon="auto" + severity="info" → sl-icon name="info-circle" in icon slot.
 *   7. icon="none" → no sl-icon element regardless of severity.
 *   8. icon absent (default) → no sl-icon element.
 *   9. explicit icon="bell" → sl-icon name="bell" in icon slot.
 *  10. dismissible=true → sl-alert has closable attribute.
 *  11. title binding renders as <strong> inside sl-alert.
 */

test.describe("ui-alert (P90)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

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
        const variant = await page.locator("sl-alert").evaluate((el) => (el as HTMLElement & { variant?: string }).getAttribute("variant") ?? "");
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

    test("icon='auto' + severity='warning' → sl-icon name='exclamation-triangle' in icon slot", async ({ page, request }) => {
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
        const name = await iconSlot.getAttribute("name");
        expect(name).toBe("exclamation-triangle");
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
        const name = await iconSlot.getAttribute("name");
        expect(name).toBe("check-circle");
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
        const name = await iconSlot.getAttribute("name");
        expect(name).toBe("x-circle");
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
        const name = await iconSlot.getAttribute("name");
        expect(name).toBe("info-circle");
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

    test("explicit icon='bell' → sl-icon name='bell' in icon slot", async ({ page, request }) => {
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
        const name = await iconSlot.getAttribute("name");
        expect(name).toBe("bell");
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
        const alert = page.locator("sl-alert");
        await expect(alert).toBeVisible();
        const hasClosable = await alert.evaluate((el) => el.hasAttribute("closable"));
        expect(hasClosable).toBe(true);
    });

    test("title binding renders as <strong> inside sl-alert", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "alApp11", root: "alApp11" })
            .node("ui-alert", {
                id: "alNode11",
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
});
