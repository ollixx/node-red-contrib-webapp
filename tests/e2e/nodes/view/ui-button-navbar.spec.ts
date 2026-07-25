import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * Bug (package-bugs bug6): ui-button nodes mounted into the `navbar` slot of an
 * `app`-layout ui-app compiled into the model but rendered INVISIBLE.
 * Reproduce by MEASURING the rendered button box (not a count/tag assert).
 */
test.describe("ui-button in the app navbar slot", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("navbar buttons render VISIBLE (measured box > 0, on-screen)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "nbApp", root: "nbApp", name: "Nav App", layout: "app" })
            .node("ui-button", { id: "nbBtn0", mount: "nbApp.navbar", label: "Meta model", order: 0 })
            .node("ui-button", { id: "nbBtn1", mount: "nbApp.navbar", label: "Model", order: 1 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "nbApp");
        await webapp.navigate("/");

        const navbar = page.locator(".webapp-slot--navbar");
        await expect(navbar).toBeVisible();

        const buttons = navbar.locator("sl-button");
        await expect(buttons).toHaveCount(2);

        for (let i = 0; i < 2; i++) {
            const btn = buttons.nth(i);
            await expect(btn).toBeVisible();
            const box = await btn.boundingBox();
            expect(box, `navbar button #${i} has a layout box`).not.toBeNull();
            expect(box!.width, `navbar button #${i} width`).toBeGreaterThan(1);
            expect(box!.height, `navbar button #${i} height`).toBeGreaterThan(1);
            const painted = await btn.evaluate((el) => {
                const base = (el.shadowRoot?.querySelector("[part=base]") as HTMLElement) ?? el;
                const cs = getComputedStyle(base);
                return { opacity: cs.opacity, visibility: cs.visibility, display: cs.display };
            });
            expect(painted.visibility).not.toBe("hidden");
            expect(painted.display).not.toBe("none");
            expect(parseFloat(painted.opacity)).toBeGreaterThan(0);
        }
    });
});
