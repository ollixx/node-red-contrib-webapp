import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P83 — ui-icon render E2E specs.
 *
 * Verifies that the ui-icon node renders as an <sl-icon> element in the served
 * page. These specs cover the render path only (editor coverage is in
 * p16d-display-nodes.spec.ts and nodes/editor/p69-icon-picker.spec.ts).
 *
 * Classic behaviour tests (msg.payload → no-op, pass-through) are covered in
 * packages/runtime/test/p83-display-nodes-behaviour.test.ts.
 */

test.describe("ui-icon render (P83)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("renders as <sl-icon> with the configured icon name", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconApp1", root: "iconApp1" })
            .node("ui-icon", { id: "iconNode1", icon: "house" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "iconApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-icon")).toBeVisible();
        const name = await page.locator("sl-icon").getAttribute("name");
        expect(name).toBe("house");
    });

    test("renders with an explicit library attribute for namespaced icons", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconApp2", root: "iconApp2" })
            .node("ui-icon", { id: "iconNode2", icon: "lucide:star" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/iconApp2/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toContain("name=\"star\"");
        expect(html).toContain("library=\"lucide\"");
    });

    test("renders without crashing when no icon is configured", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconApp3", root: "iconApp3" })
            .node("ui-icon", { id: "iconNode3" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "iconApp3");
        await webapp.navigate("/");
        // Renders the app root without a server error.
        await expect(webapp.root()).toBeVisible();
    });
});

/**
 * P159 — ui-icon size-token SelectBox E2E specs.
 *
 * Verifies that each xs..xl size token produces the correct CSS class on the
 * rendered <sl-icon> element, and that a legacy free CSS value (stored as a
 * plain string) does not crash the runtime (back-compat migration guard).
 */
test.describe("ui-icon size tokens (P159)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    for (const token of ["xs", "sm", "md", "lg", "xl"] as const) {
        test(`renders with class webapp-icon--${token} for size="${token}"`, async ({ request }) => {
            const flow = new FlowBuilder()
                .app({ id: `sizeApp_${token}`, root: `sizeApp_${token}` })
                .node("ui-icon", { id: `sizeNode_${token}`, icon: "house", size: token })
                .build();

            await deployFlow(request, flow);

            const res = await request.get(`/webapp/sizeApp_${token}/`);
            expect(res.ok()).toBeTruthy();
            const html = await res.text();
            expect(html).toContain(`webapp-icon--${token}`);
        });
    }

    test("legacy free CSS size value does not crash the runtime (migration guard)", async ({ request }) => {
        // A node stored with size="24" (old free-text field) must not cause a
        // deploy error or a 500; the page must render the icon without a size class.
        const flow = new FlowBuilder()
            .app({ id: "legacySizeApp", root: "legacySizeApp" })
            .node("ui-icon", { id: "legacySizeNode", icon: "house", size: "24" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/legacySizeApp/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        // The icon is rendered (no crash).
        expect(html).toContain("sl-icon");
        // The legacy size is passed through as a class suffix — not a 500.
        expect(html).toContain("webapp-icon--24");
    });
});
