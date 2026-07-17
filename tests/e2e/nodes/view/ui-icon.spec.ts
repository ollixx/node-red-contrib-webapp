import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
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

/**
 * P239 — the icon NAME is bindable IN THE EDITOR (ADR 0012 §Binding-Ubiquität).
 *
 * The gap this closes is EDITOR EXPOSURE, not runtime: `iconFieldSchema` has always
 * been binding-capable and P235 proved a state-bound icon resolves + swaps live —
 * but `installIconField` rendered a plain text input, so an author had no UI way to
 * set a binding (only hand-edited flow JSON, which is what every test above does).
 * These specs drive the REAL editor instead: pick a binding type in the typedInput,
 * Deploy, and measure the resolved `name` on the real <sl-icon>.
 *
 * All expected values are MEASURED against the running instance, not derived.
 */
test.describe("ui-icon icon name — editor binding (P239)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    test("the icon field offers the canonical binding set — `str` replaced by the icon literal type", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconEdApp0", root: "iconEdApp0" })
            .node("ui-icon", { id: "iconEdNode0", icon: "gear" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("iconEdNode0");

        // The control is a typedInput on the `iconBinding` carrier (ADR 0031): the
        // persisted `icon` may be a binding OBJECT, so it must NOT have a
        // #node-input-icon element — Node-RED's post-oneditsave field-copy would
        // clobber the object back to a bare string.
        await expect(page.locator("#node-input-icon")).toHaveCount(0);
        await expect(page.locator("#node-input-iconBinding + .red-ui-typedInput-container")).toHaveCount(1);

        // Open the type menu and read what the AUTHOR is actually offered.
        await page.locator("#node-input-iconBinding")
            .locator("+ .red-ui-typedInput-container .red-ui-typedInput-type-label").click();
        // Every typedInput on the panel appends its own (hidden) menu to <body>, so
        // scope to the one that is actually open — the icon field's.
        const offered = await page.locator(".red-ui-typedInput-options:visible a").evaluateAll(
            (els) => els.map((e) => e.getAttribute("value") || "")
        );
        // MEASURED against the live editor. The `icon` category is the canonical
        // value set with exactly one delta: `str` → `icon` (see valueBindingTypes).
        expect(offered).toEqual([
            "store", "query", "routeParam", "reactive", "msg", "jsonata",
            "icon", "num", "bool", "json", "date", "flow", "global", "env"
        ]);
        expect(offered).not.toContain("str");
    });

    test("author binds the icon name to a store in the EDITOR → deploy → resolved name renders and swaps live", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconEdApp1", root: "iconEdApp1" })
            .node("ui-store", { id: "iconEdStore", parent: "iconEdApp1", statePath: "iconName", initialValue: JSON.stringify("house") })
            // Starts as a LITERAL — the binding below is authored purely through the UI.
            .node("ui-icon", { id: "iconEdNode1", icon: "gear" })
            .withStoreInject("iconEdInj", "iconEdStore", "star")
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("iconEdNode1");

        // The author picks the Store type and the store node — no flow-JSON surgery.
        await editor.fillTypedInput("iconBinding", "iconEdStore", "store");
        await editor.save();

        // The typedInput's type+value serialise to the canonical binding object.
        const stored = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("iconEdNode1");
            return n ? n.icon : null;
        });
        expect(stored).toEqual({ kind: "store", path: "iconEdStore" });

        await editor.deploy();

        // MEASURED on the real element: the rendered name is the RESOLVED store
        // value ("house"), not the literal the node was deployed with ("gear").
        const webapp = new WebappPage(page, "iconEdApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-icon")).toHaveAttribute("name", "house", { timeout: 5000 });

        // The P235 live path is now reachable from the editor: a store change
        // morphs the icon via SSE, without a reload.
        await injectMessage(request, "iconEdInj");
        await expect(page.locator("sl-icon")).toHaveAttribute("name", "star", { timeout: 5000 });
    });

    test("picker + preview are literal-only: they disappear on a binding type and return on the literal", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconEdApp2", root: "iconEdApp2" })
            .node("ui-icon", { id: "iconEdNode2", icon: "house" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("iconEdNode2");

        const button = page.locator(".webapp-icon-field-button");
        const preview = page.locator(".webapp-icon-field-preview");

        // Literal mode (the stored "house"): button + preview are there, and the
        // preview really points at the icon's SVG.
        expect(await editor.readTypedInputType("iconBinding")).toBe("icon");
        await expect(button).toBeVisible();
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute(
            "src",
            "resources/node-red-contrib-webapp/shoelace/assets/icons/house.svg"
        );

        // A binding has no literal to pick or preview — both go away.
        await editor.fillTypedInput("iconBinding", "someStore", "store");
        await expect(button).toBeHidden();
        await expect(preview).toBeHidden();

        // Back to the literal path — both return.
        await editor.fillTypedInput("iconBinding", "gear", "icon");
        await expect(button).toBeVisible();
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute(
            "src",
            "resources/node-red-contrib-webapp/shoelace/assets/icons/gear.svg"
        );
    });

    test("the picker still works in literal mode: pick → save → deploy → the picked icon renders", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "iconEdApp3", root: "iconEdApp3" })
            .node("ui-icon", { id: "iconEdNode3", icon: "gear" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("iconEdNode3");

        // Really open the dialog and really pick a tile.
        await page.locator(".webapp-icon-field-button").click();
        const dialog = page.locator(".webapp-icon-picker-dialog");
        await expect(dialog).toBeVisible();
        await page.locator(".webapp-icon-picker-search").fill("house");
        await page.locator(".webapp-icon-picker-tile[data-icon-name=\"house\"]").first().click();
        await expect(dialog).toHaveCount(0);

        // The pick lands in the typedInput's literal value (not some other type).
        expect(await editor.readTypedInputType("iconBinding")).toBe("icon");
        expect(await editor.readTypedInput("iconBinding")).toBe("house");

        await editor.save();
        // A picked literal persists as the PLAIN icon name — the historical shape,
        // never a {kind:"literal"} wrapper. Back-compat for every existing flow.
        const stored = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("iconEdNode3");
            return n ? n.icon : null;
        });
        expect(stored).toBe("house");

        await editor.deploy();
        const webapp = new WebappPage(page, "iconEdApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-icon")).toHaveAttribute("name", "house", { timeout: 5000 });
    });
});

/**
 * P239 — lossless open→save round-trip for all THREE iconFieldSchema shapes.
 *
 * `icon` is the field ADR 0031's clobber bug class is most dangerous for: it has a
 * bare-string back-compat shape, a literal object shape AND a binding shape. Open →
 * Done without touching anything must drift NONE of them.
 */
test.describe("ui-icon icon round-trip (P239)", () => {
    test.afterEach(async ({ request }) => { await resetFlow(request); });

    const cases: Array<{ id: string; label: string; icon: unknown }> = [
        { id: "rtBare", label: "a back-compat BARE STRING", icon: "house" },
        { id: "rtShorthand", label: "a `library:name` shorthand string", icon: "lucide:star" },
        { id: "rtLiteral", label: "a literal {library,name}", icon: { library: "lucide", name: "star" } },
        { id: "rtDefaultLib", label: "a literal {library:'default',name}", icon: { library: "default", name: "house" } },
        { id: "rtBinding", label: "a BINDING object", icon: { kind: "state", path: "iconName" } }
    ];

    for (const testCase of cases) {
        test(`${testCase.label} survives open→save unchanged`, async ({ page, request }) => {
            const flow = new FlowBuilder()
                .app({ id: `${testCase.id}App`, root: `${testCase.id}App` })
                .node("ui-icon", { id: `${testCase.id}Node`, icon: testCase.icon })
                .build();
            await deployFlow(request, flow);

            const editor = new NodeEditorPage(page);
            await editor.open();
            await editor.openNode(`${testCase.id}Node`);
            // Touch nothing.
            await editor.save();

            const stored = await page.evaluate((id) => {
                const n = (window as unknown as {
                    RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
                }).RED.nodes.node(id);
                return n ? n.icon : null;
            }, `${testCase.id}Node`);
            expect(stored).toEqual(testCase.icon);
        });
    }
});
