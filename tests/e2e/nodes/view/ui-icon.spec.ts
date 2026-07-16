import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
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

    test("no icon configured → renders the node wrapper but no sl-icon element", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconApp3", root: "iconApp3" })
            .node("ui-icon", { id: "iconNode3" })
            .build();

        await deployFlow(request, flow);

        const res = await request.get("/webapp/iconApp3/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        // Outcome: an unconfigured icon degrades to an EMPTY leaf wrapper — the
        // node's hook attribute is present and the wrapper closes immediately with
        // NO <sl-icon> child. Asserted on the node's own fragment (not the whole
        // page, which links the Shoelace autoloader). Goes red if a default icon
        // starts rendering (`…"iconNode3"><sl-icon…`) or the node drops out.
        expect(html).toContain("data-webapp-node=\"iconNode3\"></div>");
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

/**
 * P235 — ui-icon conformance additions (node-conformance epic).
 *
 * Measured, outcome-based coverage for the gaps the P235 audit flagged:
 *   - `icon` STORE/state-binding → the live icon NAME is rendered, and a store
 *     change morphs it via SSE (the icon is binding-capable, iconFieldSchema).
 *   - `color` literal → the rendered <sl-icon> carries the colour, asserted by
 *     COMPUTED STYLE (not a tag/string check) — see below for the DERIVED value.
 *   - `visible` base field bound to a store → the render-gate (visibleIf, ADR 0037)
 *     drops / keeps the icon.
 *   - msg.payload → ui-icon uses componentStateInputHandler: it PASSES THE MESSAGE
 *     THROUGH and does NOT treat msg.payload as an icon setter (the spec: "kein
 *     primäres msg.payload-Feld"). Asserted as a truthful negative.
 */
test.describe("ui-icon icon binding (P235)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("state-bound icon renders the live name from the store", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconBindApp", root: "iconBindApp" })
            .node("ui-store", { id: "iconStore", parent: "iconBindApp", statePath: "iconName", initialValue: JSON.stringify("house") })
            .node("ui-icon", { id: "iconBindNode", icon: { kind: "state", path: "iconName" } })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/iconBindApp/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        // The renderer resolves bind.icon (state → store value "house") into
        // component.value → renderIconHtml → <sl-icon name="house">.
        expect(html).toMatch(/<sl-icon[^>]*name="house"/);
    });

    test("store change updates the rendered icon name via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconBindApp2", root: "iconBindApp2" })
            .node("ui-store", { id: "iconStore2", parent: "iconBindApp2", statePath: "iconName", initialValue: JSON.stringify("house") })
            .node("ui-icon", { id: "iconBindNode2", icon: { kind: "state", path: "iconName" } })
            .withStoreInject("iconInj2", "iconStore2", "star")
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "iconBindApp2");
        await webapp.navigate("/");
        // Initial live value.
        await expect(page.locator("sl-icon")).toHaveAttribute("name", "house");

        // Replace the store value; the store handler pushes an SSE snapshot that
        // morphs the DOM — the icon name flips to "star".
        await injectMessage(request, "iconInj2");
        await expect(page.locator("sl-icon")).toHaveAttribute("name", "star", { timeout: 5000 });
    });
});

// ui-icon's `color` is a dedicated PLAIN-STRING field (schema: z.string()) — NOT
// a binding object like ui-divider's base-field color. The serializer emits it
// RAW as an inline `style="color:<value>"` on the <sl-icon> (renderIconHtml), so
// the rendered element's computed `color` equals the configured value. (It does
// NOT go through resolveColorValue / the Shoelace `--color` custom property — that
// path is ui-divider's; do not assert `--color` here.)
test.describe("ui-icon color literal (P235)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("literal color → inline style=\"color:…\" in the served HTML", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconColApp", root: "iconColApp" })
            .node("ui-icon", { id: "iconColNode", icon: "house", color: "rgb(0, 128, 0)" })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/iconColApp/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toMatch(/<sl-icon[^>]*style="color:rgb\(0, 128, 0\)"/);
    });

    test("literal color → applied on the rendered element (computed style)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconColApp2", root: "iconColApp2" })
            .node("ui-icon", { id: "iconColNode2", icon: "house", color: "rgb(0, 128, 0)" })
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "iconColApp2");
        await webapp.navigate("/");
        const icon = page.locator("sl-icon").first();
        await expect(icon).toBeVisible();
        const color = await icon.evaluate((el) => getComputedStyle(el).color);
        // DERIVED: inline style="color:rgb(0, 128, 0)" → computed color resolves to
        // the same rgb() form.
        expect(color).toBe("rgb(0, 128, 0)");
    });
});

// P231: `visible` is in the ui-icon schema (baseFieldsSchema mixin — NOT overridden
// by ui-icon, unlike `color`), so a bound visible survives validation and reaches
// `visibleIf`; the render-gate (ADR 0037) fires. A store-bound `visible` governs the
// render (a plain literal is seeded to the neutral default `true`, ADR 0037).
test.describe("ui-icon visible render-gate (bound; ADR 0037) (P235)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("visible bound to a store=false → the icon is not rendered", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconVisApp", root: "iconVisApp" })
            .node("ui-store", { id: "iconVisStore", parent: "iconVisApp", statePath: "show", initialValue: JSON.stringify(false) })
            .node("ui-icon", { id: "iconVisNode", icon: "house", visible: { kind: "store", path: "iconVisStore" } })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/iconVisApp/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        // The whole component (wrapper + <sl-icon>) is gated out (renderer returns
        // undefined for a visibleIf=false component).
        expect(html).not.toContain("<sl-icon");
        expect(html).not.toContain("data-webapp-node=\"iconVisNode\"");
    });

    test("visible bound to a store=true → the icon is rendered", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconVisApp2", root: "iconVisApp2" })
            .node("ui-store", { id: "iconVisStore2", parent: "iconVisApp2", statePath: "show", initialValue: JSON.stringify(true) })
            .node("ui-icon", { id: "iconVisNode2", icon: "house", visible: { kind: "store", path: "iconVisStore2" } })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/iconVisApp2/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toMatch(/<sl-icon[^>]*name="house"/);
    });
});

// ui-icon uses componentStateInputHandler (packages/runtime / nodes/webapp.js):
// it recognises only `msg.ui.component.op` (show/hide/…) — which it passes through
// WITHOUT mutating fields — and passes every other message (incl. a bare
// msg.payload) straight through. It does NOT implement `msg.ui.patch` and does NOT
// treat msg.payload as an icon setter. This asserts that truthfully: injecting
// msg.payload leaves the rendered icon unchanged. (Runtime pass-through is also
// covered by packages/runtime/test/p83-display-nodes-behaviour.test.ts §8.)
test.describe("ui-icon msg.payload is pass-through (no icon setter) (P235)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("injecting msg.payload does not change the rendered icon", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconMsgApp", root: "iconMsgApp" })
            .node("ui-icon", { id: "iconMsgNode", icon: "house" })
            .withInjectNode("iconMsgInj", "iconMsgNode", "star")
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "iconMsgApp");
        await webapp.navigate("/");
        await expect(page.locator("sl-icon")).toHaveAttribute("name", "house");

        // Fire msg.payload="star" at the icon's input; componentStateInputHandler
        // passes it through and pushes NO snapshot. Give any (erroneous) SSE frame
        // time to arrive, then confirm the icon is still "house" (mutation guard:
        // goes red if ui-icon ever starts consuming msg.payload as the icon).
        await injectMessage(request, "iconMsgInj");
        await page.waitForTimeout(500);
        await expect(page.locator("sl-icon")).toHaveAttribute("name", "house");
    });
});
