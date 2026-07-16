import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P94 — ui-avatar Feld-Erweiterung (fresh tests per node-testing.md; replaces P93).
 *
 * Covers all P93 rendering bugfixes AND new P94 deliverables:
 *   - sl-avatar renders in the DOM
 *   - size (xs/sm/md/lg/xl) → data-size attribute
 *   - shape (square) → shape attribute
 *   - initials as typedInput binding (literal) → initials attribute on sl-avatar
 *   - initials as store binding → initials attribute reflects store value
 *   - src (image) as typedInput literal URL → image attribute on sl-avatar
 *   - src (image) as store binding → image attribute reflects store value
 *   - alt attribute is NOT rendered (removed in P93)
 *   - variant → data-variant attribute (Shoelace sl-avatar has no native variant)
 *   - back-compat: legacy plain-string initials (pre-P94) still work
 *   - default rendering without explicit fields
 *
 * See: tests/e2e/nodes/view/ui-avatar.tests.md
 */

test.describe("ui-avatar (P94)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── Rendering ────────────────────────────────────────────────────────────

    test("renders sl-avatar element in the DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp1", root: "avApp1" })
            .node("ui-avatar", { id: "av1" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar")).toBeVisible();
    });

    test("default state (no fields) → sl-avatar with no initials attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp2", root: "avApp2" })
            .node("ui-avatar", { id: "av2" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-avatar")).toBeVisible();
        // No initials or image attribute when not set
        const initialsVal = await page.locator("sl-avatar").getAttribute("initials");
        expect(initialsVal ?? "").toBe("");
    });

    // ── size ─────────────────────────────────────────────────────────────────

    test("size 'sm' → sl-avatar has data-size='sm'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp3", root: "avApp3" })
            .node("ui-avatar", { id: "av3", size: "sm" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar[data-size='sm']")).toBeVisible();
    });

    test("size 'lg' → sl-avatar has data-size='lg'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp4", root: "avApp4" })
            .node("ui-avatar", { id: "av4", size: "lg" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp4");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar[data-size='lg']")).toBeVisible();
    });

    test("no size → sl-avatar has no data-size attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp5", root: "avApp5" })
            .node("ui-avatar", { id: "av5" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp5");
        await webapp.navigate("/");
        const dataSizeVal = await page.locator("sl-avatar").getAttribute("data-size");
        expect(dataSizeVal).toBeNull();
    });

    // ── shape ─────────────────────────────────────────────────────────────────

    test("shape 'square' → sl-avatar has shape='square'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp6", root: "avApp6" })
            .node("ui-avatar", { id: "av6", shape: "square" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp6");
        await webapp.navigate("/");
        const shape = await page.locator("sl-avatar").getAttribute("shape");
        expect(shape).toBe("square");
    });

    test("shape 'circle' → sl-avatar does not have shape='square'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp7", root: "avApp7" })
            .node("ui-avatar", { id: "av7", shape: "circle" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp7");
        await webapp.navigate("/");
        const shape = await page.locator("sl-avatar").getAttribute("shape");
        // circle is the sl-avatar default; may be explicit or omitted
        expect(shape ?? "circle").not.toBe("square");
    });

    // ── initials as typedInput binding (P94) ──────────────────────────────────

    test("initials literal binding 'JD' → sl-avatar has initials='JD'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp8", root: "avApp8" })
            .node("ui-avatar", { id: "av8", initials: { kind: "literal", value: "JD" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp8");
        await webapp.navigate("/");
        const initials = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).initials ?? el.getAttribute("initials") ?? ""
        );
        expect(initials).toBe("JD");
    });

    test("initials binding NOT rendered as '[object Object]'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp9", root: "avApp9" })
            .node("ui-avatar", { id: "av9", initials: { kind: "literal", value: "AB" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp9");
        await webapp.navigate("/");
        const html = await page.locator("sl-avatar").evaluate((el) => el.outerHTML);
        expect(html).not.toContain("[object Object]");
    });

    test("initials store binding → sl-avatar initials resolved from store string value", async ({ page, request }) => {
        // Store holds a plain string — direct initials value.
        const flow = new FlowBuilder()
            .app({ id: "avApp10", root: "avApp10" })
            .node("ui-store", { id: "avStore10", statePath: "avatarInitials", initialValue: JSON.stringify("SK") })
            .node("ui-avatar", { id: "av10", initials: { kind: "store", path: "avStore10" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp10");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar")).toBeVisible();
        const initials = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).initials ?? el.getAttribute("initials") ?? ""
        );
        expect(initials).toBe("SK");
    });

    // ── src (image) as typedInput binding (P94) ───────────────────────────────

    test("src literal URL binding → sl-avatar image attribute is the URL", async ({ page, request }) => {
        const imageUrl = "https://example.com/avatar.png";
        const flow = new FlowBuilder()
            .app({ id: "avApp11", root: "avApp11" })
            .node("ui-avatar", { id: "av11", src: { kind: "literal", value: imageUrl } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp11");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar")).toBeVisible();
        const image = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).image ?? el.getAttribute("image") ?? ""
        );
        expect(String(image)).toBe(imageUrl);
    });

    test("src store binding with URL string → sl-avatar image attribute reflects store value", async ({ page, request }) => {
        const imageUrl = "https://example.com/store-avatar.png";
        const flow = new FlowBuilder()
            .app({ id: "avApp12", root: "avApp12" })
            .node("ui-store", { id: "avStore12", statePath: "avatarUrl", initialValue: JSON.stringify(imageUrl) })
            .node("ui-avatar", { id: "av12", src: { kind: "store", path: "avStore12" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp12");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar")).toBeVisible();
        const image = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).image ?? el.getAttribute("image") ?? ""
        );
        expect(String(image)).toBe(imageUrl);
    });

    // ── alt removed (P93) ────────────────────────────────────────────────────

    test("alt attribute is NOT rendered on sl-avatar (removed in P93)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp13", root: "avApp13" })
            .node("ui-avatar", { id: "av13" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp13");
        await webapp.navigate("/");
        const altVal = await page.locator("sl-avatar").getAttribute("alt");
        expect(altVal).toBeNull();
    });

    // ── variant (P94) ─────────────────────────────────────────────────────────

    test("variant 'primary' → sl-avatar has data-variant='primary'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp14", root: "avApp14" })
            .node("ui-avatar", { id: "av14", variant: "primary" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp14");
        await webapp.navigate("/");
        const variant = await page.locator("sl-avatar").getAttribute("data-variant");
        expect(variant).toBe("primary");
    });

    test("variant 'danger' → sl-avatar has data-variant='danger'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp15", root: "avApp15" })
            .node("ui-avatar", { id: "av15", variant: "danger" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp15");
        await webapp.navigate("/");
        const variant = await page.locator("sl-avatar").getAttribute("data-variant");
        expect(variant).toBe("danger");
    });

    test("no variant → sl-avatar has no data-variant attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp16", root: "avApp16" })
            .node("ui-avatar", { id: "av16" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp16");
        await webapp.navigate("/");
        const variant = await page.locator("sl-avatar").getAttribute("data-variant");
        expect(variant).toBeNull();
    });

    test("variant uses data-variant not native variant attr (Shoelace has no native variant)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp17", root: "avApp17" })
            .node("ui-avatar", { id: "av17", variant: "neutral" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp17");
        await webapp.navigate("/");
        // Shoelace sl-avatar has NO native `variant` attr; only `data-variant` must be set.
        const nativeVariant = await page.locator("sl-avatar").getAttribute("variant");
        const dataVariant = await page.locator("sl-avatar").getAttribute("data-variant");
        expect(nativeVariant).toBeNull();
        expect(dataVariant).toBe("neutral");
    });

    // ── Combined ─────────────────────────────────────────────────────────────

    test("size + shape + initials + variant all rendered correctly", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avApp18", root: "avApp18" })
            .node("ui-avatar", {
                id: "av18",
                size: "sm",
                shape: "square",
                initials: { kind: "literal", value: "MR" },
                variant: "success"
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp18");
        await webapp.navigate("/");
        const avatar = page.locator("sl-avatar");
        await expect(avatar).toBeVisible();
        expect(await avatar.getAttribute("data-size")).toBe("sm");
        expect(await avatar.getAttribute("shape")).toBe("square");
        expect(await avatar.getAttribute("data-variant")).toBe("success");
        const initials = await avatar.evaluate(
            (el) => (el as any).initials ?? el.getAttribute("initials") ?? ""
        );
        expect(initials).toBe("MR");
    });

    test("src URL set — image attribute is URL, initials not shown as attr", async ({ page, request }) => {
        const imageUrl = "https://example.com/user.png";
        const flow = new FlowBuilder()
            .app({ id: "avApp19", root: "avApp19" })
            .node("ui-avatar", {
                id: "av19",
                src: { kind: "literal", value: imageUrl },
                initials: { kind: "literal", value: "XY" }
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp19");
        await webapp.navigate("/");
        const image = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).image ?? el.getAttribute("image") ?? ""
        );
        // src is set — image attribute should be the URL
        expect(String(image)).toBe(imageUrl);
        // When src is set, initials attr is not emitted (fallback-chain: src wins)
        const initialsAttr = await page.locator("sl-avatar").getAttribute("initials");
        expect(initialsAttr ?? "").toBe("");
    });

    // ── Back-compat: legacy plain-string initials (pre-P94) ──────────────────

    test("legacy plain-string initials (pre-P94 flow) → still rendered correctly", async ({ page, request }) => {
        // Old flows stored initials as a plain string, not a binding object.
        // mapConfig converts it to { kind: "literal", value: "XX" } for back-compat.
        const flow = new FlowBuilder()
            .app({ id: "avApp20", root: "avApp20" })
            .node("ui-avatar", { id: "av20", initials: "XX" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avApp20");
        await webapp.navigate("/");
        const initials = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).initials ?? el.getAttribute("initials") ?? ""
        );
        expect(initials).toBe("XX");
    });
});
