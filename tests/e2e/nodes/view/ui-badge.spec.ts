import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P92 — ui-badge Felder-Rework (fresh tests per node-testing.md; replaces P43).
 * P103 — size-Feld entfernt: size-Tests durch "kein data-size" ersetzt.
 * P153 — valuePath → value typedInput (ADR 0012): migration test added.
 *
 * Covers all current deliverables:
 *   - displayType: square / rounded (default) / pill → correct Shoelace attrs
 *   - variant (renamed from severity): SEVERITY_VARIANTS → sl-badge variant attr
 *   - pulsating: true → sl-badge pulse attr
 *   - size removed (P103): no data-size attr ever emitted
 *   - value binding renders inside sl-badge
 *   - default rendering without explicit fields
 *   - legacy valuePath migrated to state binding (P153)
 *
 * See: tests/e2e/nodes/view/ui-badge.tests.md
 */

test.describe("ui-badge (P92/P103)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── Rendering ────────────────────────────────────────────────────────────

    test("renders sl-badge with literal value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp1", root: "badgeApp1" })
            .node("ui-badge", { id: "badge1", value: { kind: "literal", value: "42" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-badge")).toContainText("42");
    });

    test("default state (no variant/displayType) → sl-badge shows the literal value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp2", root: "badgeApp2" })
            .node("ui-badge", { id: "badge2", value: { kind: "literal", value: "0" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp2");
        await webapp.navigate("/");
        await expect(page.locator("sl-badge")).toBeVisible();
        await expect(page.locator("sl-badge")).toContainText("0");
    });

    // ── displayType ─────────────────────────────────────────────────────────

    test("displayType 'pill' → sl-badge has pill attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp3", root: "badgeApp3" })
            .node("ui-badge", { id: "badge3", value: { kind: "literal", value: "5" }, displayType: "pill" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp3");
        await webapp.navigate("/");
        // Shoelace reflects `pill` as a boolean attribute or property
        const hasPill = await page.locator("sl-badge").evaluate((el) => {
            return el.hasAttribute("pill") || (el as any).pill === true;
        });
        expect(hasPill).toBe(true);
    });

    test("displayType 'rounded' → sl-badge has no pill attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp4", root: "badgeApp4" })
            .node("ui-badge", { id: "badge4", value: { kind: "literal", value: "3" }, displayType: "rounded" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp4");
        await webapp.navigate("/");
        const hasPill = await page.locator("sl-badge").evaluate((el) => {
            return el.hasAttribute("pill") || (el as any).pill === true;
        });
        expect(hasPill).toBe(false);
    });

    test("displayType 'square' → sl-badge has data-display-type='square'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp5", root: "badgeApp5" })
            .node("ui-badge", { id: "badge5", value: { kind: "literal", value: "!" }, displayType: "square" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp5");
        await webapp.navigate("/");
        const dataAttr = await page.locator("sl-badge").getAttribute("data-display-type");
        expect(dataAttr).toBe("square");
    });

    // ── variant (semantic colour role) ────────────────────────────────────────

    test("variant 'success' → sl-badge variant='success'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp6", root: "badgeApp6" })
            .node("ui-badge", { id: "badge6", value: { kind: "literal", value: "OK" }, variant: "success" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp6");
        await webapp.navigate("/");
        const variant = await page.locator("sl-badge").evaluate((el) => {
            return el.getAttribute("variant") ?? (el as any).variant ?? "";
        });
        expect(variant).toBe("success");
    });

    test("variant 'danger' → sl-badge variant='danger'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp7", root: "badgeApp7" })
            .node("ui-badge", { id: "badge7", value: { kind: "literal", value: "ERR" }, variant: "danger" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp7");
        await webapp.navigate("/");
        const variant = await page.locator("sl-badge").evaluate((el) => {
            return el.getAttribute("variant") ?? (el as any).variant ?? "";
        });
        expect(variant).toBe("danger");
    });

    test("variant 'warning' → sl-badge variant='warning'", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp8", root: "badgeApp8" })
            .node("ui-badge", { id: "badge8", value: { kind: "literal", value: "!" }, variant: "warning" })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp8");
        await webapp.navigate("/");
        const variant = await page.locator("sl-badge").evaluate((el) => {
            return el.getAttribute("variant") ?? (el as any).variant ?? "";
        });
        expect(variant).toBe("warning");
    });

    // ── pulsating ────────────────────────────────────────────────────────────

    test("pulsating: true → sl-badge has pulse attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp9", root: "badgeApp9" })
            .node("ui-badge", { id: "badge9", value: { kind: "literal", value: "3" }, pulsating: true })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp9");
        await webapp.navigate("/");
        const hasPulse = await page.locator("sl-badge").evaluate((el) => {
            return el.hasAttribute("pulse") || (el as any).pulse === true;
        });
        expect(hasPulse).toBe(true);
    });

    test("pulsating omitted → sl-badge has no pulse attribute", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp10", root: "badgeApp10" })
            .node("ui-badge", { id: "badge10", value: { kind: "literal", value: "1" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp10");
        await webapp.navigate("/");
        const hasPulse = await page.locator("sl-badge").evaluate((el) => {
            return el.hasAttribute("pulse") || (el as any).pulse === true;
        });
        expect(hasPulse).toBe(false);
    });

    // ── size removed (P103) ───────────────────────────────────────────────────

    test("no size field → sl-badge has no data-size attribute (P103)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp11", root: "badgeApp11" })
            .node("ui-badge", { id: "badge11", value: { kind: "literal", value: "x" } })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp11");
        await webapp.navigate("/");
        const size = await page.locator("sl-badge").getAttribute("data-size");
        expect(size).toBeNull();
    });

    // ── P153: valuePath migration ─────────────────────────────────────────────

    test("legacy valuePath renders badge value (P153 migration)", async ({ page, request }) => {
        // Old flows stored `valuePath` as a plain string state path.
        // webapp.js mapConfig converts valuePath → state binding automatically.
        // The store must publish the value so the renderer resolves it.
        const flow = new FlowBuilder()
            .app({ id: "badgeApp13", root: "badgeApp13" })
            .node("ui-badge", {
                id: "badge13",
                // Simulate a pre-P153 flow: valuePath set, value absent.
                valuePath: "badge.label",
                value: undefined
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp13");
        await webapp.navigate("/");
        // Badge renders (no crash) — value resolves to empty string via state binding.
        await expect(page.locator("sl-badge")).toBeVisible();
    });

    // ── combined: pill + pulsating + variant ─────────────────────────────────

    test("pill + pulsating + variant 'primary' combined (no data-size, P103)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "badgeApp12", root: "badgeApp12" })
            .node("ui-badge", {
                id: "badge12",
                value: { kind: "literal", value: "NEW" },
                displayType: "pill",
                variant: "primary",
                pulsating: true
            })
            .build();
        await deployFlow(request, flow);
        const webapp = new WebappPage(page, "badgeApp12");
        await webapp.navigate("/");
        await expect(page.locator("sl-badge")).toContainText("NEW");
        const hasPill = await page.locator("sl-badge").evaluate((el) => el.hasAttribute("pill") || (el as any).pill === true);
        const hasPulse = await page.locator("sl-badge").evaluate((el) => el.hasAttribute("pulse") || (el as any).pulse === true);
        const variant = await page.locator("sl-badge").evaluate((el) => el.getAttribute("variant") ?? (el as any).variant ?? "");
        const size = await page.locator("sl-badge").getAttribute("data-size");
        expect(hasPill).toBe(true);
        expect(hasPulse).toBe(true);
        expect(variant).toBe("primary");
        expect(size).toBeNull();
    });
});
