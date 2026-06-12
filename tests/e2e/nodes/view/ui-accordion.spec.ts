import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P169 — per-node E2E spec for ui-accordion / ui-accordion-section (ADR 0018,
 * Model 1a — children define the sections). Mirror of ui-tabs.spec.ts.
 *
 * The `sections` JSON config-array is GONE: the sections are derived from the
 * mounted `ui-accordion-section` children (one collapsible panel per child, slot
 * key = child id). The two-way `openSection` binding (mirror of ui-tabs
 * `activeTab`) carries the open CHILD id. Content mounts into
 * `ui-accordion-section:<sectionId>/content`.
 *
 * Covers (see tests/e2e/nodes/view/ui-accordion.tests.md):
 *   R01  rendering: two ui-accordion-section children render as sl-details panels.
 *   R02  content: each section's child subtree renders into its own panel.
 *   O01  openSection literal binding marks the matching section open.
 *   O02  openSection state binding resolves the open section from the store.
 *   O03  external store change → SSE re-render opens the section.
 *   D01  default: no openSection → the first child by order is open.
 *   M01  migration: a legacy sections-JSON flow still renders the migrated sections.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree — the
 * orchestrator runs the full E2E suite on the merged develop branch.
 */

// Helper: append two ui-accordion-section children + (optionally) a ui-text body
// per section, mounted into the given ui-accordion id.
function withTwoSections(
    builder: FlowBuilder,
    accId: string,
    opts: { bodies?: boolean } = {}
): FlowBuilder {
    builder
        .node("ui-accordion-section", { id: "overview", mount: `ui-accordion:${accId}/content`, label: { kind: "literal", value: "Overview" }, order: 0 })
        .node("ui-accordion-section", { id: "details", mount: `ui-accordion:${accId}/content`, label: { kind: "literal", value: "Details" }, order: 1 });
    if (opts.bodies) {
        builder
            .node("ui-text", { id: `${accId}_ovBody`, mount: "ui-accordion-section:overview/content", text: "Overview body" })
            .node("ui-text", { id: `${accId}_deBody`, mount: "ui-accordion-section:details/content", text: "Details body" });
    }
    return builder;
}

test.describe("ui-accordion / ui-accordion-section (P169, children model)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("R01 — two ui-accordion-section children render as sl-details panels", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "ac169R1App", root: "ac169R1App" })
            .node("ui-accordion", { id: "ac169R1" });
        const flow = withTwoSections(builder, "ac169R1").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ac169R1App");
        await webapp.navigate("/");

        const details = page.locator(".webapp-accordion > sl-details");
        await expect(details).toHaveCount(2);
        await expect(details.nth(0)).toHaveAttribute("summary", "Overview");
        await expect(details.nth(1)).toHaveAttribute("summary", "Details");
        await expect(page.locator("sl-details[name='overview']")).toBeAttached();
        await expect(page.locator("sl-details[name='details']")).toBeAttached();
    });

    test("R02 — each section's content renders into its own panel", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "ac169R2App", root: "ac169R2App" })
            .node("ui-accordion", { id: "ac169R2", openSection: { kind: "literal", value: "overview" } });
        const flow = withTwoSections(builder, "ac169R2", { bodies: true }).build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ac169R2App");
        await webapp.navigate("/");

        await expect(page.locator("sl-details[name='overview']")).toContainText("Overview body");
        await expect(page.locator("sl-details[name='details']")).toContainText("Details body");
        // overview is open.
        await expect(page.locator("sl-details[name='overview']")).toHaveAttribute("open", "");
    });

    // ─── openSection binding (read source) ───────────────────────────────────

    test("O01 — openSection literal binding marks the matching section open", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "ac169O1App", root: "ac169O1App" })
            .node("ui-accordion", { id: "ac169O1", openSection: { kind: "literal", value: "details" } });
        const flow = withTwoSections(builder, "ac169O1").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ac169O1App");
        await webapp.navigate("/");
        await expect(page.locator("sl-details[name='details']")).toHaveAttribute("open", "");
    });

    test("O02 — openSection state binding resolves the open section from the store", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "ac169O2App", root: "ac169O2App" })
            .node("ui-store", {
                id: "ac169O2Store",
                statePath: "view",
                initialValue: JSON.stringify({ section: "details" })
            })
            .node("ui-accordion", { id: "ac169O2", openSection: { kind: "state", path: "view.section" } });
        const flow = withTwoSections(builder, "ac169O2").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ac169O2App");
        await webapp.navigate("/");
        await expect(page.locator("sl-details[name='details']")).toHaveAttribute("open", "");
    });

    test("O03 — external store change → SSE re-render opens the section", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "ac169O3App", root: "ac169O3App" })
            .node("ui-store", {
                id: "ac169O3Store",
                statePath: "view",
                initialValue: JSON.stringify({ section: "overview" })
            })
            .node("ui-accordion", { id: "ac169O3", openSection: { kind: "state", path: "view.section" } });
        withTwoSections(builder, "ac169O3");
        const flow = builder.withStoreInject("ac169O3Inj", "ac169O3Store", { section: "details" }).build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ac169O3App");
        await webapp.navigate("/");
        await expect(page.locator("sl-details[name='overview']")).toHaveAttribute("open", "");

        await injectMessage(request, "ac169O3Inj");
        await expect(page.locator("sl-details[name='details']")).toHaveAttribute("open", "", { timeout: 5000 });
    });

    // ─── default open section ────────────────────────────────────────────────

    test("D01 — no openSection → the first child by order is open", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "ac169D1App", root: "ac169D1App" })
            .node("ui-accordion", { id: "ac169D1" });
        const flow = withTwoSections(builder, "ac169D1").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ac169D1App");
        await webapp.navigate("/");
        // overview has order 0 → it is the default open section.
        await expect(page.locator("sl-details[name='overview']")).toHaveAttribute("open", "");
    });

    // ─── migration (legacy sections-JSON flow) ───────────────────────────────

    test("M01 — legacy sections-JSON flow migrates: sections + content still render", async ({ page, request }) => {
        // Simulate a pre-P169 flow: a `sections` array on ui-accordion + a content
        // child mounting into the legacy derived slot `section:overview`.
        const flow = new FlowBuilder()
            .app({ id: "ac169M1App", root: "ac169M1App" })
            .node("ui-accordion", {
                id: "ac169M1",
                sections: JSON.stringify([
                    { id: "overview", label: "Overview" },
                    { id: "details", label: "Details" }
                ]),
                openSection: { kind: "literal", value: "details" }
            })
            .node("ui-text", { id: "ac169M1Body", mount: "section:overview", text: "Legacy Overview body" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "ac169M1App");
        await webapp.navigate("/");
        await expect(page.locator("sl-details[name='overview']")).toHaveAttribute("summary", "Overview");
        await expect(page.locator("sl-details[name='details']")).toHaveAttribute("open", "");
        await expect(page.locator("sl-details[name='overview']")).toContainText("Legacy Overview body");
    });
});
