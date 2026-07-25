import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P168 — per-node E2E spec for ui-tabs/ui-tab (ADR 0018, Model 1a — children
 * define the sections).
 *
 * The `tabs` JSON config-array is GONE: the tabs are derived from the mounted
 * `ui-tab` children (one panel per child, slot key = child id). The two-way
 * `activeTab` binding (P155/ADR 0012) carries the active CHILD id. Content mounts
 * into `ui-tab:<tabId>/content`.
 *
 * Covers (see tests/e2e/nodes/view/ui-tabs.tests.md):
 *   R01  rendering: two ui-tab children render as sl-tab / sl-tab-panel pairs.
 *   R02  content: each tab's child subtree renders into its own panel.
 *   A01  activeTab literal binding marks the matching sl-tab active.
 *   A02  activeTab state binding resolves the active tab from the store.
 *   A03  activeTab two-way write-back: tab click → change event → wired store set
 *        → SSE re-render activates the chosen tab (the browser-proof round-trip).
 *   A04  external store change → SSE re-render activates the tab.
 *   D01  default: no activeTab → the first child by order is active.
 *   E01  change event: sl-tab-show emits change with params.value = child id.
 *   M01  migration: a legacy tabs-JSON flow still renders the migrated tabs.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree — the
 * orchestrator runs the full E2E suite on the merged develop branch.
 */

// Helper: append two ui-tab children + (optionally) a ui-text body per tab to a
// FlowBuilder, mounted into the given ui-tabs id.
function withTwoTabs(
    builder: FlowBuilder,
    tabsId: string,
    opts: { bodies?: boolean; ov?: string; de?: string } = {}
): FlowBuilder {
    // The ui-tab node id IS the tab id (the slot key + activeTab token), so use
    // distinct, stable ids per ui-tabs. Children mount via `ui-tab:<id>/content`.
    // Each test deploys exactly one ui-tabs (resetFlow runs between tests), so the
    // tab ids can be the stable, asserted-on "overview"/"details".
    const ovId = opts.ov ?? "overview";
    const deId = opts.de ?? "details";
    builder
        .node("ui-tab", { id: ovId, mount: `ui-tabs:${tabsId}/content`, label: { kind: "literal", value: "Overview" }, order: 0 })
        .node("ui-tab", { id: deId, mount: `ui-tabs:${tabsId}/content`, label: { kind: "literal", value: "Details" }, order: 1 });
    if (opts.bodies) {
        builder
            .node("ui-text", { id: `${tabsId}_ovBody`, mount: `ui-tab:${ovId}/content`, text: "Overview body" })
            .node("ui-text", { id: `${tabsId}_deBody`, mount: `ui-tab:${deId}/content`, text: "Details body" });
    }
    return builder;
}

test.describe("ui-tabs / ui-tab (P168, children model)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("R01 — two ui-tab children render as sl-tab / sl-tab-panel pairs", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "tb168R1App", root: "tb168R1App" })
            .node("ui-tabs", { id: "tb168R1" });
        const flow = withTwoTabs(builder, "tb168R1").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168R1App");
        await webapp.navigate("/");

        await expect(page.locator("sl-tab-group")).toBeVisible();
        await expect(page.locator("sl-tab[panel='overview']")).toContainText("Overview");
        await expect(page.locator("sl-tab[panel='details']")).toContainText("Details");
        await expect(page.locator("sl-tab-panel[name='overview']")).toBeAttached();
        await expect(page.locator("sl-tab-panel[name='details']")).toBeAttached();
    });

    test("R02 — each ui-tab's content renders into its own panel; switching shows it", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "tb168R2App", root: "tb168R2App" })
            .node("ui-tabs", { id: "tb168R2", activeTab: { kind: "literal", value: "overview" } });
        const flow = withTwoTabs(builder, "tb168R2", { bodies: true }).build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168R2App");
        await webapp.navigate("/");

        // both panels exist with their respective content.
        await expect(page.locator("sl-tab-panel[name='overview']")).toContainText("Overview body");
        await expect(page.locator("sl-tab-panel[name='details']")).toContainText("Details body");
        // overview is active.
        await expect(page.locator("sl-tab[panel='overview']")).toHaveAttribute("active", "");

        // switching to details surfaces its panel (Shoelace toggles active panel).
        await page.locator("sl-tab[panel='details']").click();
        await expect(page.locator("sl-tab-panel[name='details']")).toBeVisible();
    });

    // ─── activeTab binding (read source) ─────────────────────────────────────

    test("A01 — activeTab literal binding marks the matching sl-tab active", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "tb168A1App", root: "tb168A1App" })
            .node("ui-tabs", { id: "tb168A1", activeTab: { kind: "literal", value: "details" } });
        const flow = withTwoTabs(builder, "tb168A1").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168A1App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "");
    });

    test("A02 — activeTab state binding resolves the active tab from the store", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "tb168A2App", root: "tb168A2App" })
            .node("ui-store", {
                id: "tb168A2Store",
                statePath: "view",
                initialValue: JSON.stringify({ tab: "details" })
            })
            .node("ui-tabs", { id: "tb168A2", activeTab: { kind: "state", path: "view.tab" } });
        const flow = withTwoTabs(builder, "tb168A2").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168A2App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "");
    });

    // ─── activeTab two-way write-back (the browser-proof round-trip) ──────────

    test("A03 — two-way write-back: tab click → change event → wired store set → active tab moves", async ({ page, request }) => {
        const writeBackFnId = "tb168A3Fn";
        const builder = new FlowBuilder()
            .app({ id: "tb168A3App", root: "tb168A3App" })
            .node("ui-store", {
                id: "tb168A3Store",
                statePath: "view",
                initialValue: JSON.stringify({ tab: "overview" })
            })
            .node("ui-tabs", {
                id: "tb168A3",
                activeTab: { kind: "state", path: "view.tab" },
                events: JSON.stringify(["change"]),
                wires: [[writeBackFnId]]
            });
        const flow = withTwoTabs(builder, "tb168A3").build();

        flow.push({
            type: "function",
            id: writeBackFnId,
            name: writeBackFnId,
            func: 'msg.ui = { store: { id: "tb168A3Store", op: "set", path: "tab", value: msg.ui.params.value } }; return msg;',
            outputs: 1,
            z: flow[0].id,
            x: 400,
            y: 420,
            wires: [["tb168A3Store"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168A3App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='overview']")).toHaveAttribute("active", "");

        // Selecting the "details" tab → change event → function → store set → SSE.
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
        const builder = new FlowBuilder()
            .app({ id: "tb168A4App", root: "tb168A4App" })
            .node("ui-store", {
                id: "tb168A4Store",
                statePath: "view",
                initialValue: JSON.stringify({ tab: "overview" })
            })
            .node("ui-tabs", { id: "tb168A4", activeTab: { kind: "state", path: "view.tab" } });
        withTwoTabs(builder, "tb168A4");
        const flow = builder.withStoreInject("tb168A4Inj", "tb168A4Store", { tab: "details" }).build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168A4App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='overview']")).toHaveAttribute("active", "");

        await injectMessage(request, "tb168A4Inj");
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "", { timeout: 5000 });
    });

    // ─── default active tab ──────────────────────────────────────────────────

    test("D01 — no activeTab → the first child by order is active", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "tb168D1App", root: "tb168D1App" })
            .node("ui-tabs", { id: "tb168D1" });
        const flow = withTwoTabs(builder, "tb168D1").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168D1App");
        await webapp.navigate("/");
        // overview has order 0 → it is the default active tab.
        await expect(page.locator("sl-tab[panel='overview']")).toHaveAttribute("active", "");
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("E01 — sl-tab-show → POST /event { event:'change', params.value = child id }", async ({ page, request }) => {
        const builder = new FlowBuilder()
            .app({ id: "tb168E1App", root: "tb168E1App" })
            .node("ui-tabs", { id: "tb168E1", events: JSON.stringify(["change"]) });
        const flow = withTwoTabs(builder, "tb168E1").build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168E1App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='overview']")).toHaveAttribute("active", "");

        // Wait for THIS dispatch's `details` change event specifically (by predicate).
        // We deliberately do NOT depend on the tab group's OWN upgrade-time sl-tab-show
        // (the default "overview" change): whether Shoelace auto-emits it — and whether
        // P257's single-active re-stamp pre-activates the default tab and suppresses it —
        // is pure timing and is not this node's contract (D01 covers default-active
        // rendering). Matching `details` tolerates that noise with no flaky drain and no
        // 30s hang, and stays honest — a wrong event/value never satisfies the predicate,
        // so a real regression still fails the test. (Was the long-standing E01 flake;
        // see P170/P239 result notes and P257 which tipped it into isolation.)
        const detailsEvent = page.waitForRequest((req) => {
            if (req.method() !== "POST" || !req.url().includes("/webapp/tb168E1App/event")) return false;
            try {
                const b = req.postDataJSON() as { event?: string; params?: { value?: string } };
                return b?.event === "change" && b?.params?.value === "details";
            } catch {
                return false;
            }
        });
        await page.evaluate(() => {
            const tabGroup = document.querySelector("sl-tab-group") as HTMLElement;
            tabGroup?.dispatchEvent(new CustomEvent("sl-tab-show", {
                detail: { name: "details" },
                bubbles: true,
                composed: true
            }));
        });

        const body = (await detailsEvent).postDataJSON() as { event: string; params: { value: string } };
        expect(body.event).toBe("change");
        expect(body.params.value).toBe("details");
    });

    // ─── variant appearance (P250) ───────────────────────────────────────────

    // V01 — `variant` (line/contained/pills) is a NON-colour APPEARANCE. MEASURED:
    // each value emits an observable `data-variant` on the sl-tab-group (P250 —
    // mirrors the ui-avatar data-variant precedent; sl-tab-group has no native
    // variant, so the value does NOT go through the colour mapVariant table). Absent
    // → the documented default "line", so the attribute is always present.
    for (const [variant, expected] of [
        [undefined, "line"], // default when the field is absent
        ["line", "line"],
        ["contained", "contained"],
        ["pills", "pills"]
    ] as const) {
        test(`V01 — variant ${variant ?? "(absent)"} → data-variant="${expected}" on sl-tab-group`, async ({ page, request }) => {
            const appId = `tb250V_${expected}App`;
            const builder = new FlowBuilder()
                .app({ id: appId, root: appId })
                .node("ui-tabs", { id: `tb250V_${expected}`, ...(variant ? { variant } : {}) });
            const flow = withTwoTabs(builder, `tb250V_${expected}`).build();

            await deployFlow(request, flow);

            const webapp = new WebappPage(page, appId);
            await webapp.navigate("/");

            await expect(page.locator("sl-tab-group")).toHaveAttribute("data-variant", expected);
        });
    }

    // ─── migration (legacy tabs-JSON flow) ───────────────────────────────────

    test("M01 — legacy tabs-JSON flow migrates: tabs + content still render", async ({ page, request }) => {
        // Simulate a pre-P167 flow: a `tabs` array on ui-tabs + a content child
        // mounting into the legacy derived slot `tab:overview`.
        const flow = new FlowBuilder()
            .app({ id: "tb168M1App", root: "tb168M1App" })
            .node("ui-tabs", {
                id: "tb168M1",
                tabs: JSON.stringify([
                    { id: "overview", label: "Overview" },
                    { id: "details", label: "Details" }
                ]),
                activeTab: { kind: "literal", value: "details" }
            })
            .node("ui-text", { id: "tb168M1Body", mount: "tab:overview", text: "Legacy Overview body" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tb168M1App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='overview']")).toContainText("Overview");
        await expect(page.locator("sl-tab[panel='details']")).toHaveAttribute("active", "");
        await expect(page.locator("sl-tab-panel[name='overview']")).toContainText("Legacy Overview body");
    });

    test("L01 — a ui-tab label bound to a store resolves to the store value (content resolves too)", async ({ page, request }) => {
        // Bug (package-bugs): a store-bound ui-tab LABEL did not resolve (showed
        // empty/id), while the SAME store binding in the tab CONTENT resolved fine.
        const storeBinding = { kind: "store", path: "tbL1Store", subPath: { kind: "literal", value: "title" } };
        const flow = new FlowBuilder()
            .app({ id: "tbL1App", root: "tbL1App" })
            .node("ui-store", { id: "tbL1Store", statePath: "s", initialValue: JSON.stringify({ title: "FromStore" }) })
            .node("ui-tabs", { id: "tbL1" })
            .node("ui-tab", { id: "storeTab", mount: "ui-tabs:tbL1/content", label: storeBinding, order: 0 })
            .node("ui-tab", { id: "staticTab", mount: "ui-tabs:tbL1/content", label: { kind: "literal", value: "Static" }, order: 1 })
            .node("ui-text", { id: "storeTabBody", mount: "ui-tab:storeTab/content", value: storeBinding })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tbL1App");
        await webapp.navigate("/");

        // Content resolves (the working half) — sanity so the test proves the LABEL gap specifically.
        await expect(page.locator("sl-tab-panel[name='storeTab']")).toContainText("FromStore");
        // The bug: the NAV tab label must show the resolved store value, not the id/empty.
        await expect(page.locator("sl-tab[panel='storeTab']")).toContainText("FromStore");
    });

    test("L02 — a store-bound ui-tab label updates on SSE store change (like the content does)", async ({ page, request }) => {
        // Dynamic half of the bug: the store is filled/updated at runtime; the tab
        // CONTENT re-renders via SSE, the tab LABEL must too.
        const storeBinding = { kind: "store", path: "tbL2Store", subPath: { kind: "literal", value: "title" } };
        const builder = new FlowBuilder()
            .app({ id: "tbL2App", root: "tbL2App" })
            .node("ui-store", { id: "tbL2Store", statePath: "s", initialValue: JSON.stringify({ title: "First" }) })
            .node("ui-tabs", { id: "tbL2" })
            .node("ui-tab", { id: "dynTab", mount: "ui-tabs:tbL2/content", label: storeBinding, order: 0 })
            .node("ui-tab", { id: "otherTab", mount: "ui-tabs:tbL2/content", label: { kind: "literal", value: "Other" }, order: 1 })
            .node("ui-text", { id: "dynTabBody", mount: "ui-tab:dynTab/content", value: storeBinding });
        const flow = builder.withStoreInject("tbL2Inj", "tbL2Store", { title: "Second" }).build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tbL2App");
        await webapp.navigate("/");
        await expect(page.locator("sl-tab[panel='dynTab']")).toContainText("First");

        await injectMessage(request, "tbL2Inj");
        // Content re-renders (working half):
        await expect(page.locator("sl-tab-panel[name='dynTab']")).toContainText("Second", { timeout: 5000 });
        // Label must re-render too (the bug):
        await expect(page.locator("sl-tab[panel='dynTab']")).toContainText("Second", { timeout: 5000 });
    });

    test("L03 — store-bound tab label resolves when the store is filled at runtime (no initialValue)", async ({ page, request }) => {
        // Exact metaapp shape: the ui-store has NO initialValue (starts empty) and
        // is populated at runtime; the tab CONTENT (store.text) updates, the tab
        // LABEL (store.label) must too.
        const labelBinding = { kind: "store", path: "tbL3Store", subPath: { kind: "literal", value: "label0" } };
        const textBinding = { kind: "store", path: "tbL3Store", subPath: { kind: "literal", value: "text0" } };
        const builder = new FlowBuilder()
            .app({ id: "tbL3App", root: "tbL3App" })
            .node("ui-store", { id: "tbL3Store", statePath: "example" }) // NO initialValue — starts empty
            .node("ui-tabs", { id: "tbL3" })
            .node("ui-tab", { id: "mTab0", mount: "ui-tabs:tbL3/content", label: labelBinding, order: 0 })
            .node("ui-tab", { id: "mTab1", mount: "ui-tabs:tbL3/content", label: { kind: "literal", value: "Other" }, order: 1 })
            .node("ui-text", { id: "mTab0Body", mount: "ui-tab:mTab0/content", value: textBinding });
        const flow = builder.withStoreInject("tbL3Inj", "tbL3Store", { label0: "Model A", text0: "content of A" }).build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tbL3App");
        await webapp.navigate("/");
        await injectMessage(request, "tbL3Inj");

        // Content resolves after the store is filled (working half):
        await expect(page.locator("sl-tab-panel[name='mTab0']")).toContainText("content of A", { timeout: 5000 });
        // The bug: the label must resolve too, not stay the tab id "mTab0":
        await expect(page.locator("sl-tab[panel='mTab0']")).toContainText("Model A", { timeout: 5000 });
    });

});
