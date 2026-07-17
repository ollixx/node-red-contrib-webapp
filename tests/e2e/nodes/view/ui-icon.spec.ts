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

// NOTE (P238, ADR 0039 §4): the comment that stood here described ui-icon's
// `color` as a dedicated PLAIN-STRING field (schema: z.string()) emitted RAW.
// That override is GONE — `color` is now the shared BASE field (a binding), and
// the value is resolved through resolveColorValue like every other node's colour.
// The two P235 tests below still pass unchanged and are deliberately KEPT: their
// `color: "rgb(0, 128, 0)"` is a plain string, i.e. exactly the pre-P238 DEPLOYED
// shape, so they now double as back-compat coverage (the value passes through
// resolveColorValue untouched). The P238 block further down adds the token,
// binding, free-colour and #ff0000 back-compat proofs.
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

/**
 * P238 (ADR 0039) — the `color` standard control on ui-icon: tokens + any colour
 * + binding, and the removal of the plain-string override.
 *
 * Every expected value below was MEASURED against a real Node-RED serving this
 * exact flow (computed style read in the browser), never derived on paper:
 *
 *   token:primary  → style="color:var(--wa-color-primary)"     → rgb(59, 130, 246)
 *   token:success  → style="color:var(--wa-color-success)"     → rgb(34, 197, 94)
 *   token:danger   → style="color:var(--wa-color-danger)"      → rgb(239, 68, 68)
 *   #ff0000        → style="color:#ff0000"                     → rgb(255, 0, 0)
 *   (no colour)    → no style attribute                        → rgb(17, 24, 39)
 *
 * The `--wa-color-*` custom properties are THIS project's design tokens, defined
 * on `:root` (nodes/webapp.js) and overridable per app via ui-app `designTokens`
 * — that is why a token FOLLOWS the theme while a free colour is fixed. They are
 * NOT Shoelace's `--sl-color-*-600`; the roadmap/ADR prose used that only as an
 * illustrative "e.g.". The defaults measured above come from that :root block
 * (--wa-color-primary:#3b82f6, --wa-color-success:#22c55e, --wa-color-danger:#ef4444,
 * --wa-color-text:#111827).
 *
 * The unit-level twin (token→CSS-var resolution + the plain-string migration) is
 * packages/runtime/test/p238-color-standard-control.test.ts.
 */
test.describe("ui-icon color: theme token (P238)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("token:primary → the design-token CSS custom property (computed style)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tokApp1", root: "tokApp1" })
            .node("ui-icon", { id: "tokIcon1", icon: "house", color: { kind: "literal", value: "token:primary" } })
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tokApp1");
        await webapp.navigate("/");
        const icon = page.locator("sl-icon").first();
        await expect(icon).toBeVisible();

        const color = await icon.evaluate((el) => getComputedStyle(el).color);
        // MEASURED: var(--wa-color-primary) → :root --wa-color-primary:#3b82f6.
        expect(color).toBe("rgb(59, 130, 246)");
        // …and it is NOT the default text colour — i.e. the token actually applied
        // rather than the icon simply inheriting (--wa-color-text:#111827).
        expect(color).not.toBe("rgb(17, 24, 39)");
    });

    test("token:primary is rendered as a CSS var, never as raw `color: primary`", async ({ request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tokApp2", root: "tokApp2" })
            .node("ui-icon", { id: "tokIcon2", icon: "house", color: { kind: "literal", value: "token:primary" } })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/tokApp2/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        expect(html).toMatch(/<sl-icon[^>]*style="color:var\(--wa-color-primary\)"/);
        // The whole point of the `token:` prefix (ADR 0039 §1): a bare token is not
        // a valid CSS colour and must never reach the DOM.
        expect(html).not.toContain("color:primary");
        expect(html).not.toContain("color:token:primary");
    });

    test("an icon with NO colour has no style attribute (inherits the theme text colour)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tokApp3", root: "tokApp3" })
            .node("ui-icon", { id: "tokIcon3", icon: "house" })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/tokApp3/");
        const html = await res.text();
        expect(html).toMatch(/<sl-icon class="webapp-icon" name="house" data-webapp-node="tokIcon3">/);

        const webapp = new WebappPage(page, "tokApp3");
        await webapp.navigate("/");
        // MEASURED: inherits body colour (--wa-color-text:#111827). This is the
        // baseline the token test above asserts it is NOT.
        expect(await page.locator("sl-icon").first().evaluate((el) => getComputedStyle(el).color))
            .toBe("rgb(17, 24, 39)");
    });
});

test.describe("ui-icon color: free colour via the selector (P238)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    // The colour selector persists a plain literal binding — `{kind:"literal",
    // value:"<css>"}` — so THIS is the shape the picker produces. (P235's literal
    // test above covers the pre-P238 PLAIN-STRING shape, which is a different
    // input: it is the back-compat path, not what the selector writes.)
    test("a selector colour (#ff0000) renders as that colour (computed style)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "freeApp1", root: "freeApp1" })
            .node("ui-icon", { id: "freeIcon1", icon: "house", color: { kind: "literal", value: "#ff0000" } })
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "freeApp1");
        await webapp.navigate("/");
        const icon = page.locator("sl-icon").first();
        await expect(icon).toBeVisible();
        // MEASURED: style="color:#ff0000" → computed rgb(255, 0, 0).
        expect(await icon.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 0, 0)");
    });
});

test.describe("ui-icon color: back-compat with a deployed plain string (P238)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    // The migration guard for ADR 0039 §4. Before P238 ui-icon's `color` was a
    // plain string (`z.string()`), so every DEPLOYED ui-icon carries one. With the
    // override removed the base schema is `bindingSchema.optional()` — a bare
    // string would now FAIL validation and the icon would drop out of the app.
    // normalizeColorField (nodes/webapp.js mapConfig) migrates it to a literal
    // binding before validation, so the flow renders unchanged without being
    // re-opened. Goes red if that migration is ever dropped.
    test("a deployed plain-string colour still renders unchanged (computed style)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcApp1", root: "bcApp1" })
            .node("ui-icon", { id: "bcIcon1", icon: "house", color: "#ff0000" })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/bcApp1/");
        expect(res.ok()).toBeTruthy();
        const html = await res.text();
        // The node did not drop out (it would if the plain string failed validation).
        expect(html).toMatch(/<sl-icon[^>]*style="color:#ff0000"/);

        const webapp = new WebappPage(page, "bcApp1");
        await webapp.navigate("/");
        const icon = page.locator("sl-icon").first();
        await expect(icon).toBeVisible();
        // MEASURED: identical to the literal-binding path — no flow loses its colour.
        expect(await icon.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 0, 0)");
    });
});

/**
 * THE headline P238 proof (ADR 0039 §4): a state/store-BOUND colour on ui-icon.
 * This was IMPOSSIBLE before P238 — `color` was a plain string, so getBinding()
 * never matched it, bind.color stayed empty and no binding could ever drive the
 * icon's colour. Both tests below would fail on the pre-P238 code.
 *
 * Note the flow keeps ONE ui-app: a store update is routed to the app that owns
 * the store node by flow tab (P201, findAppIdForNode), so several apps sharing a
 * tab would misfile the update under the first app and the icon would never
 * update. FlowBuilder + resetFlow already give one app per test.
 */
test.describe("ui-icon color: bound to a store (P238)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("a store-bound colour colours the icon", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "colBindApp1", root: "colBindApp1" })
            .node("ui-store", { id: "colStore1", parent: "colBindApp1", statePath: "iconColor", initialValue: JSON.stringify("token:success") })
            .node("ui-icon", { id: "colBindIcon1", icon: "house", color: { kind: "store", path: "colStore1" } })
            .build();
        await deployFlow(request, flow);

        const res = await request.get("/webapp/colBindApp1/");
        const html = await res.text();
        // The renderer resolves bind.color (store → "token:success") into
        // resolvedProps.color, and the serializer resolves the TOKEN from there —
        // so a token stored as data works exactly like one configured in the editor.
        expect(html).toMatch(/<sl-icon[^>]*style="color:var\(--wa-color-success\)"/);

        const webapp = new WebappPage(page, "colBindApp1");
        await webapp.navigate("/");
        const icon = page.locator("sl-icon").first();
        await expect(icon).toBeVisible();
        // MEASURED: var(--wa-color-success) → :root --wa-color-success:#22c55e.
        expect(await icon.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(34, 197, 94)");
    });

    test("a store change recolours the icon live via SSE", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "colBindApp2", root: "colBindApp2" })
            .node("ui-store", { id: "colStore2", parent: "colBindApp2", statePath: "iconColor", initialValue: JSON.stringify("token:success") })
            .node("ui-icon", { id: "colBindIcon2", icon: "house", color: { kind: "store", path: "colStore2" } })
            .withStoreInject("colInj2", "colStore2", "token:danger")
            .build();
        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "colBindApp2");
        await webapp.navigate("/");
        const icon = page.locator("sl-icon").first();
        await expect(icon).toBeVisible();

        // MEASURED initial value (--wa-color-success:#22c55e).
        await expect.poll(async () => icon.evaluate((el) => getComputedStyle(el).color), { timeout: 5000 })
            .toBe("rgb(34, 197, 94)");

        // Replace the store value; the store handler pushes an SSE snapshot that
        // morphs the DOM — WITHOUT a page reload.
        await injectMessage(request, "colInj2");

        // MEASURED after the SSE morph (--wa-color-danger:#ef4444).
        await expect.poll(async () => icon.evaluate((el) => getComputedStyle(el).color), { timeout: 5000 })
            .toBe("rgb(239, 68, 68)");
    });
});
