import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-toast (composite node).
 *
 * Covers:
 *   - Not visible by default (no sl-alert in the DOM on page load).
 *   - Input port message → toast appears via SSE (sl-alert appended to body).
 *   - Toast carries severity from node definition.
 *   - Toast message comes from msg.payload.
 */

test.describe("ui-toast (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("not visible by default — no toast in DOM on page load", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp1", root: "toastApp1" })
            // ui-toast has no mount — it does not render into the layout.
            .node("ui-toast", {
                id: "toastNode1",
                severity: "info",
                duration: 3000
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp1");
        await webapp.navigate("/");

        // No sl-alert.webapp-toast should be present before a message is injected.
        await expect(page.locator("sl-alert.webapp-toast")).toHaveCount(0);
    });

    test("input port message → sl-alert.webapp-toast appears in DOM via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp2", root: "toastApp2" })
            .node("ui-toast", {
                id: "toastNode2",
                severity: "success",
                duration: 5000
            })
            .withInjectNode("toastInj2", "toastNode2", "Toast message appeared!")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp2");
        await webapp.navigate("/");

        // Inject a message to trigger the toast.
        await injectMessage(request, "toastInj2");

        // The toast should appear as sl-alert appended to the body.
        const toast = page.locator("sl-alert.webapp-toast");
        await expect(toast).toBeVisible({ timeout: 5000 });
        await expect(toast).toContainText("Toast message appeared!");
    });

    test("toast carries the severity from the node definition", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp3", root: "toastApp3" })
            .node("ui-toast", {
                id: "toastNode3",
                severity: "warning",
                duration: 5000
            })
            .withInjectNode("toastInj3", "toastNode3", "Warning!")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp3");
        await webapp.navigate("/");

        await injectMessage(request, "toastInj3");

        const toast = page.locator("sl-alert.webapp-toast");
        await expect(toast).toBeVisible({ timeout: 5000 });
        await expect(toast).toHaveAttribute("variant", "warning");
    });

    // P254 — `duration` is observable: a positive value auto-dismisses (the toast
    // is removed from the DOM after ~N ms via a client-side timer); 0 persists.
    test("duration=N → toast is removed from the DOM after ~N ms (measured)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp4", root: "toastApp4" })
            .node("ui-toast", {
                id: "toastNode4",
                severity: "info",
                // Short auto-dismiss window so the test measures the real removal.
                duration: 700
            })
            .withInjectNode("toastInj4", "toastNode4", "Auto-dismiss me")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp4");
        await webapp.navigate("/");

        await injectMessage(request, "toastInj4");

        const toast = page.locator("sl-alert.webapp-toast");
        await expect(toast).toBeVisible({ timeout: 5000 });

        // Still present well before the 700 ms timer elapses (did not vanish
        // instantly) — proves the toast was actually shown for a measurable span.
        await page.waitForTimeout(300);
        await expect(toast).toHaveCount(1);

        // …and gone after the timer fires. Playwright auto-waits for removal.
        await expect(toast).toHaveCount(0, { timeout: 3000 });
    });

    test("duration=0 → toast persists (no auto-dismiss)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "toastApp5", root: "toastApp5" })
            .node("ui-toast", {
                id: "toastNode5",
                severity: "info",
                duration: 0
            })
            .withInjectNode("toastInj5", "toastNode5", "Sticky toast")
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp5");
        await webapp.navigate("/");

        await injectMessage(request, "toastInj5");

        const toast = page.locator("sl-alert.webapp-toast");
        await expect(toast).toBeVisible({ timeout: 5000 });

        // No auto-dismiss timer is armed for duration=0 — the toast is still in the
        // DOM well past any plausible default timeout.
        await page.waitForTimeout(1500);
        await expect(toast).toHaveCount(1);
    });

    // P254 — `position` is observable: each of the four enum values produces a
    // measurably distinct placement (CSS class + computed bounding box).
    test("position → four values produce distinct, measured placements", async ({ page, request }) => {
        const positions = ["top-right", "top-center", "bottom-right", "bottom-center"] as const;

        const builder = new FlowBuilder().app({ id: "toastApp6", root: "toastApp6" });
        positions.forEach((position, i) => {
            builder
                .node("ui-toast", {
                    id: `toastNode6_${i}`,
                    severity: "info",
                    duration: 0,
                    position
                })
                .withInjectNode(`toastInj6_${i}`, `toastNode6_${i}`, `pos ${position}`);
        });
        const flow = builder.build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "toastApp6");
        await webapp.navigate("/");

        // Fire all four toasts.
        for (let i = 0; i < positions.length; i++) {
            await injectMessage(request, `toastInj6_${i}`);
        }

        const viewport = page.viewportSize();
        if (!viewport) {
            throw new Error("viewport size unavailable");
        }

        // Collect each toast's measured box. getBoundingClientRect (read in-page)
        // is the real placement measurement and is robust to the sl-alert being a
        // zero-area custom-element host (where Playwright's boundingBox() is null).
        const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
        for (const position of positions) {
            const el = page.locator(`sl-alert.webapp-toast--${position}`);
            await expect(el).toHaveCount(1, { timeout: 5000 });
            const box = await el.evaluate((node) => {
                const r = (node as HTMLElement).getBoundingClientRect();
                return { x: r.left, y: r.top, width: r.width, height: r.height };
            });
            boxes[position] = box;
        }

        const midX = viewport.width / 2;
        const midY = viewport.height / 2;

        // Vertical anchor: top-* sit in the upper half, bottom-* in the lower half.
        expect(boxes["top-right"].y).toBeLessThan(midY);
        expect(boxes["top-center"].y).toBeLessThan(midY);
        expect(boxes["bottom-right"].y + boxes["bottom-right"].height).toBeGreaterThan(midY);
        expect(boxes["bottom-center"].y + boxes["bottom-center"].height).toBeGreaterThan(midY);

        // Horizontal anchor: -center toasts are centred (their mid-x is near the
        // viewport centre); -right toasts are right-anchored (mid-x past centre).
        const topCenterMid = boxes["top-center"].x + boxes["top-center"].width / 2;
        const bottomCenterMid = boxes["bottom-center"].x + boxes["bottom-center"].width / 2;
        const topRightMid = boxes["top-right"].x + boxes["top-right"].width / 2;
        const bottomRightMid = boxes["bottom-right"].x + boxes["bottom-right"].width / 2;

        expect(Math.abs(topCenterMid - midX)).toBeLessThan(40);
        expect(Math.abs(bottomCenterMid - midX)).toBeLessThan(40);
        expect(topRightMid).toBeGreaterThan(midX);
        expect(bottomRightMid).toBeGreaterThan(midX);

        // The centred and right-anchored toasts occupy clearly different x-positions.
        expect(topRightMid - topCenterMid).toBeGreaterThan(40);
        expect(bottomRightMid - bottomCenterMid).toBeGreaterThan(40);
    });
});
