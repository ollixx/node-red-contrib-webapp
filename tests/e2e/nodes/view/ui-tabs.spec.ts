import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P155 — per-node E2E specs for ui-tabs (ADR 0012 field-typing wave 2).
 *
 * `activeTabPath` → `activeTab` (TWO-WAY value typedInput: reads the active tab
 * from a bound Store/state AND, on tab change, emits the `change` event carrying
 * the chosen tab id so a wired flow writes it back to that store). The existing
 * tab-change event on the out-port is unchanged. Scope is ONLY the active tab —
 * the `tabs` list is out of scope.
 *
 * Covers (see tests/e2e/nodes/view/ui-tabs.tests.md):
 *   R01      rendering: two tabs render as sl-tab / sl-tab-panel pairs.
 *   A01      activeTab literal binding marks the matching sl-tab active.
 *   A02      activeTab state binding resolves the active tab from the store.
 *   A03      activeTab two-way write-back: tab click → change event → wired store
 *            set → SSE re-render activates the chosen tab.
 *   A04      external store change → SSE re-render activates the tab.
 *   E01      change event: sl-tab-show emits change with params.value = tab id.
 *   M01      migration: a legacy activeTabPath plain path still resolves.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree — the
 * orchestrator runs the full E2E suite on the merged develop branch.
 */

const TABS = JSON.stringify([
    { id: "overview", label: "Overview" },
    { id: "details", label: "Details" }
]);

test.describe("ui-tabs (P155)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("R01 — two tabs render as sl-tab / sl-tab-panel pairs", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tb155R1App", root: "tb155R1App" })
            .node("ui-tabs", { id: "tb155R1", tabs: TABS })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb155R1App");
        await webapp.navigate("/");

        await expect(page.locator("sl-tab-group")).toBeVisible();
        await expect(page.locator("sl-tab[panel='overview']")).toContainText("Overview");
        await expect(page.locator("sl-tab[panel='details']")).toContainText("Details");
        await expect(page.locator("sl-tab-panel[name='overview']")).toBeAttached();
        await expect(page.locator("sl-tab-panel[name='details']")).toBeAttached();
    });

    // ─── activeTab binding (read source) ─────────────────────────────────────

    test("A01 — activeTab literal binding marks the matching sl-tab active", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tb155A1App", root: "tb155A1App" })
            .node("ui-tabs", {
                id: "tb155A1",
                tabs: TABS,
                activeTab: { kind: "literal", value: "details" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb155A1App");
        await webapp.navigate("/");
        // the resolved active tab is "details".
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "");
    });

    test("A02 — activeTab state binding resolves the active tab from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tb155A2App", root: "tb155A2App" })
            .node("ui-store", {
                id: "tb155A2Store",
                statePath: "view",
                initialValue: JSON.stringify({ tab: "details" })
            })
            .node("ui-tabs", {
                id: "tb155A2",
                tabs: TABS,
                activeTab: { kind: "state", path: "view.tab" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb155A2App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "");
    });

    // ─── activeTab two-way write-back ────────────────────────────────────────

    test("A03 — two-way write-back: tab click → change event → wired store set → active tab moves", async ({ page, request }) => {
        // A function node converts the tabs `change` event into a store `set` of
        // view.tab = params.value (the documented store-roundtrip wiring). The
        // tabs' activeTab binding reads the SAME store slice, so the SSE re-render
        // activates the chosen tab — the two-way loop closes.
        const writeBackFnId = "tb155A3Fn";
        const flow = new FlowBuilder()
            .app({ id: "tb155A3App", root: "tb155A3App" })
            .node("ui-store", {
                id: "tb155A3Store",
                statePath: "view",
                initialValue: JSON.stringify({ tab: "overview" })
            })
            .node("ui-tabs", {
                id: "tb155A3",
                tabs: TABS,
                activeTab: { kind: "state", path: "view.tab" },
                events: JSON.stringify(["change"]),
                wires: [[writeBackFnId]]
            })
            .build();

        flow.push({
            type: "function",
            id: writeBackFnId,
            name: writeBackFnId,
            func: 'msg.ui = { store: { id: "tb155A3Store", op: "set", path: "tab", value: msg.ui.params.value } }; return msg;',
            outputs: 1,
            z: flow[0].id,
            x: 400,
            y: 420,
            wires: [["tb155A3Store"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb155A3App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='overview']")).toHaveAttribute("active", "");

        // Simulate selecting the "details" tab → change event → function → store set → SSE.
        await page.evaluate(() => {
            const tabGroup = document.querySelector("sl-tab-group") as HTMLElement;
            tabGroup?.dispatchEvent(new CustomEvent("sl-tab-show", {
                detail: { name: "details" },
                bubbles: true,
                composed: true
            }));
        });

        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "", { timeout: 5000 });
    });

    test("A04 — external store change → SSE re-render activates the tab", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tb155A4App", root: "tb155A4App" })
            .node("ui-store", {
                id: "tb155A4Store",
                statePath: "view",
                initialValue: JSON.stringify({ tab: "overview" })
            })
            .node("ui-tabs", {
                id: "tb155A4",
                tabs: TABS,
                activeTab: { kind: "state", path: "view.tab" }
            })
            .withStoreInject("tb155A4Inj", "tb155A4Store", { tab: "details" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb155A4App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='overview']")).toHaveAttribute("active", "");

        await injectMessage(request, "tb155A4Inj");
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "", { timeout: 5000 });
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("E01 — sl-tab-show → POST /event { event:'change', params.value = tab id }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tb155E1App", root: "tb155E1App" })
            .node("ui-tabs", {
                id: "tb155E1",
                tabs: TABS,
                events: JSON.stringify(["change"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb155E1App");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.evaluate(() => {
            const tabGroup = document.querySelector("sl-tab-group") as HTMLElement;
            tabGroup?.dispatchEvent(new CustomEvent("sl-tab-show", {
                detail: { name: "details" },
                bubbles: true,
                composed: true
            }));
        });

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).value).toBe("details");
    });

    // ─── migration (legacy plain path) ───────────────────────────────────────

    test("M01 — legacy activeTabPath migrated: active tab read from the store", async ({ page, request }) => {
        // Simulate a pre-P155 flow: a plain-string path, no binding object.
        const flow = new FlowBuilder()
            .app({ id: "tb155M1App", root: "tb155M1App" })
            .node("ui-store", {
                id: "tb155M1Store",
                statePath: "view",
                initialValue: JSON.stringify({ tab: "details" })
            })
            .node("ui-tabs", {
                id: "tb155M1",
                tabs: TABS,
                activeTabPath: "view.tab"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb155M1App");
        await webapp.navigate("/");
        // the legacy path migrates to a state binding → "details" active.
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "");
    });
});
