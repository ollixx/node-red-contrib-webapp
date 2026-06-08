import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P93 — ui-avatar Rendering-Bugfixes (fresh tests per node-testing.md; replaces P43).
 *
 * Covers all P93 deliverables:
 *   - sl-avatar is rendered in the DOM
 *   - size (sm/md/lg) → data-size attribute on sl-avatar
 *   - shape (square) → shape attribute on sl-avatar
 *   - initials (plain string) → initials attribute on sl-avatar
 *   - src binding (literal) → image attribute on sl-avatar
 *   - alt attribute is NOT rendered (removed in P93)
 *   - default rendering without explicit fields
 *
 * See: tests/e2e/nodes/view/ui-avatar.tests.md
 */

test.describe("ui-avatar (P93)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── Rendering ────────────────────────────────────────────────────────────

    test("renders sl-avatar element in the DOM", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp1", root: "avatarApp1" })
            .node("ui-avatar", { id: "av1" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar")).toBeVisible();
    });

    test("renders without error when no fields are set (default state)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp2", root: "avatarApp2" })
            .node("ui-avatar", { id: "av2" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp2");
        await webapp.navigate("/");
        await expect(webapp.root()).toBeVisible();
        await expect(page.locator("sl-avatar")).toBeVisible();
        // No initials or image attribute when not set
        const initialsVal = await page.locator("sl-avatar").getAttribute("initials");
        expect(initialsVal ?? "").toBe("");
    });

    // ── size (Bug 1) ─────────────────────────────────────────────────────────

    test("size 'sm' → sl-avatar has data-size='sm'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp3", root: "avatarApp3" })
            .node("ui-avatar", { id: "av3", size: "sm" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp3");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar[data-size='sm']")).toBeVisible();
    });

    test("size 'lg' → sl-avatar has data-size='lg'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp4", root: "avatarApp4" })
            .node("ui-avatar", { id: "av4", size: "lg" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp4");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar[data-size='lg']")).toBeVisible();
    });

    test("no size → sl-avatar has no data-size attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp5", root: "avatarApp5" })
            .node("ui-avatar", { id: "av5" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp5");
        await webapp.navigate("/");
        const dataSizeVal = await page.locator("sl-avatar").getAttribute("data-size");
        expect(dataSizeVal).toBeNull();
    });

    // ── shape (Bug 2) ────────────────────────────────────────────────────────

    test("shape 'square' → sl-avatar has shape='square'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp6", root: "avatarApp6" })
            .node("ui-avatar", { id: "av6", shape: "square" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp6");
        await webapp.navigate("/");
        const shape = await page.locator("sl-avatar").getAttribute("shape");
        expect(shape).toBe("square");
    });

    test("shape 'circle' → sl-avatar does not have shape='square'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp7", root: "avatarApp7" })
            .node("ui-avatar", { id: "av7", shape: "circle" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp7");
        await webapp.navigate("/");
        const shape = await page.locator("sl-avatar").getAttribute("shape");
        // circle is the sl-avatar default; may be explicit or omitted
        expect(shape ?? "circle").not.toBe("square");
    });

    // ── initials (Bug 3) ─────────────────────────────────────────────────────

    test("initials 'JD' → sl-avatar has initials='JD'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp8", root: "avatarApp8" })
            .node("ui-avatar", { id: "av8", initials: "JD" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp8");
        await webapp.navigate("/");
        // Shoelace reflects `initials` property; check attribute or property
        const initials = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).initials ?? el.getAttribute("initials") ?? ""
        );
        expect(initials).toBe("JD");
    });

    test("initials are NOT rendered as '[object Object]'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp9", root: "avatarApp9" })
            .node("ui-avatar", { id: "av9", initials: "AB" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp9");
        await webapp.navigate("/");
        const html = await page.locator("sl-avatar").evaluate((el) => el.outerHTML);
        expect(html).not.toContain("[object Object]");
    });

    // ── src binding ──────────────────────────────────────────────────────────

    test("src literal binding → sl-avatar image attribute is the URL", async ({ page, request }) => {
        const imageUrl = "https://example.com/avatar.png";
        const flow = new FlowBuilder()
            .app({ id: "avatarApp10", root: "avatarApp10" })
            .node("ui-avatar", { id: "av10", src: { kind: "literal", value: imageUrl } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp10");
        await webapp.navigate("/");
        await expect(page.locator("sl-avatar")).toBeVisible();
        const image = await page.locator("sl-avatar").evaluate(
            (el) => (el as any).image ?? el.getAttribute("image") ?? ""
        );
        expect(String(image)).toBe(imageUrl);
    });

    // ── alt removed (Bug 4) ──────────────────────────────────────────────────

    test("alt attribute is NOT rendered on sl-avatar (removed in P93)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp11", root: "avatarApp11" })
            .node("ui-avatar", { id: "av11" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp11");
        await webapp.navigate("/");
        const altVal = await page.locator("sl-avatar").getAttribute("alt");
        expect(altVal).toBeNull();
    });

    // ── Combined ─────────────────────────────────────────────────────────────

    test("size 'sm' + shape 'square' + initials 'MR' all rendered correctly", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "avatarApp12", root: "avatarApp12" })
            .node("ui-avatar", { id: "av12", size: "sm", shape: "square", initials: "MR" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "avatarApp12");
        await webapp.navigate("/");
        const avatar = page.locator("sl-avatar");
        await expect(avatar).toBeVisible();
        expect(await avatar.getAttribute("data-size")).toBe("sm");
        expect(await avatar.getAttribute("shape")).toBe("square");
        const initials = await avatar.evaluate(
            (el) => (el as any).initials ?? el.getAttribute("initials") ?? ""
        );
        expect(initials).toBe("MR");
    });
});
