import { expect, test } from "@playwright/test";

import { deployFlow, type NodeDef, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P119 (ADR 0011) — ui-action navigate EDITOR target-mode UX.
 * (P243/ADR 0040: ui-navigation retired — navigation is solely a ui-action navigate.)
 *
 * The navigate verb gets an explicit, stored target SOURCE — wire | route | url —
 * surfaced as a three-segment switch whose active segment colours the whole panel
 * (blue wire / purple route / neutral url, P120 tokens). A transitive wire-scan
 * pre-selects the mode and assists with a placeholder mapping table; the route
 * mode offers a picker + a hard-validated mapping table.
 *
 * These specs drive the real Node-RED editor (port 1882) via RED.editor.edit and
 * the WebappEditorCommon helpers. The wire-scan helper is also unit-checked
 * directly through page.evaluate against a deployed branching flow.
 */

// Build a ui-action wired through a function node to a ui-route (transitive).
function wiredFlow(opts: { app: string; routePath: string; actionId: string; routeId: string }): NodeDef[] {
    const flow = new FlowBuilder()
        .app({ id: opts.app, root: opts.app, name: opts.app })
        .node("ui-text", { id: `${opts.app}Home`, text: "Home content" })
        .route({ id: opts.routeId, path: opts.routePath })
        .node("ui-text", { id: `${opts.routeId}Txt`, text: "Detail content" })
        .build();
    // ui-action → function → ui-route (the function is the intermediate hop).
    const fnId = `${opts.actionId}__fn`;
    flow.push({
        type: "ui-action", id: opts.actionId, uiId: opts.actionId, name: opts.actionId,
        app: opts.app, actionType: "navigate",
        z: "e2e-flow", x: 100, y: 400, wires: [[fnId]]
    });
    flow.push({
        type: "function", id: fnId, name: fnId, func: "return msg;", outputs: 1,
        z: "e2e-flow", x: 300, y: 400, wires: [[opts.routeId]]
    });
    return flow;
}

test.describe("editor — navigate target modes (P119)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── wire-scan helper (unit-level, via the live editor graph) ──────────────

    test("scanWiredNavigationTargets finds a transitively-wired route through a function node", async ({ page, request }) => {
        await deployFlow(request, wiredFlow({ app: "ntA", routePath: "/customers/:id", actionId: "ntActionA", routeId: "ntRouteA" }));
        const editor = new NodeEditorPage(page);
        await editor.open();

        const result = await page.evaluate(() => {
            const W = (window as unknown as { WebappEditorCommon: {
                scanWiredNavigationTargets: (id: string) => Array<{ path: string; placeholders: string[] }>;
            } }).WebappEditorCommon;
            return W.scanWiredNavigationTargets("ntActionA");
        });

        expect(result.length).toBe(1);
        expect(result[0].path).toBe("/customers/:id");
        expect(result[0].placeholders).toEqual(["id"]);
    });

    test("scanWiredNavigationTargets returns a SET for a branching flow (two routes)", async ({ page, request }) => {
        // ui-action → switch → two routes.
        const flow = new FlowBuilder()
            .app({ id: "ntB", root: "ntB" })
            .node("ui-text", { id: "ntBHome", text: "Home" })
            .route({ id: "ntBR1", path: "/alpha/:a" })
            .node("ui-text", { id: "ntBR1Txt", text: "Alpha" })
            .route({ id: "ntBR2", path: "/beta/:b" })
            .node("ui-text", { id: "ntBR2Txt", text: "Beta" })
            .build();
        flow.push({
            type: "ui-action", id: "ntActionB", uiId: "ntActionB", name: "ntActionB",
            app: "ntB", actionType: "navigate", z: "e2e-flow", x: 100, y: 400,
            wires: [["ntBSwitch"]]
        });
        flow.push({
            type: "switch", id: "ntBSwitch", name: "ntBSwitch", property: "topic", propertyType: "msg",
            rules: [{ t: "eq", v: "a", vt: "str" }, { t: "eq", v: "b", vt: "str" }],
            outputs: 2, z: "e2e-flow", x: 300, y: 400, wires: [["ntBR1"], ["ntBR2"]]
        });
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        const paths = await page.evaluate(() => {
            const W = (window as unknown as { WebappEditorCommon: {
                scanWiredNavigationTargets: (id: string) => Array<{ path: string }>;
            } }).WebappEditorCommon;
            return W.scanWiredNavigationTargets("ntActionB").map((t) => t.path).sort();
        });
        expect(paths).toEqual(["/alpha/:a", "/beta/:b"]);
    });

    // ── initial mode pre-selection (wire-scan) + wire badge/heading ───────────

    test("a navigate action wired (via function) to a route opens in WIRE mode with the route path", async ({ page, request }) => {
        await deployFlow(request, wiredFlow({ app: "ntC", routePath: "/customers/:id", actionId: "ntActionC", routeId: "ntRouteC" }));
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ntActionC");

        // Stored targetMode resolves to "wire" (nothing saved yet → scan found 1).
        await expect(page.locator("#node-input-targetMode")).toHaveValue("wire");
        // The wire panel shows the single resolved target + its :id placeholder row.
        await expect(page.locator(".webapp-nav-wire-single")).toContainText("via Wire → /customers/:id");
        await expect(page.locator(".webapp-nav-param-name")).toContainText(":id");
        // Panel takes the wire (blue) class.
        await expect(page.locator(".webapp-nav-mode-panel")).toHaveClass(/webapp-path-panel--wire/);
    });

    test("branching wire opens with the multi-target badge and a runtime hint, no validation error", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ntD", root: "ntD" })
            .node("ui-text", { id: "ntDHome", text: "Home" })
            .route({ id: "ntDR1", path: "/alpha/:a" })
            .node("ui-text", { id: "ntDR1Txt", text: "Alpha" })
            .route({ id: "ntDR2", path: "/beta/:b" })
            .node("ui-text", { id: "ntDR2Txt", text: "Beta" })
            .build();
        flow.push({
            type: "ui-action", id: "ntActionD", uiId: "ntActionD", name: "ntActionD",
            app: "ntD", actionType: "navigate", z: "e2e-flow", x: 100, y: 400,
            wires: [["ntDSwitch"]]
        });
        flow.push({
            type: "switch", id: "ntDSwitch", name: "ntDSwitch", property: "topic", propertyType: "msg",
            rules: [{ t: "eq", v: "a", vt: "str" }, { t: "eq", v: "b", vt: "str" }],
            outputs: 2, z: "e2e-flow", x: 300, y: 400, wires: [["ntDR1"], ["ntDR2"]]
        });
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ntActionD");

        await expect(page.locator(".webapp-nav-wire-multi")).toContainText("2 mögliche Ziele");
        await expect(page.locator(".webapp-nav-wire-runtime-hint")).toContainText("Laufzeitverantwortung");
        // A heuristic scan never blocks the deploy.
        expect(await editor.getValidationState("ntActionD")).toBe("valid");
    });

    // ── mode switching: stored intent wins after save ─────────────────────────

    test("switching to ROUTE mode shows the transport info, persists across reopen", async ({ page, request }) => {
        await deployFlow(request, wiredFlow({ app: "ntE", routePath: "/customers/:id", actionId: "ntActionE", routeId: "ntRouteE" }));
        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ntActionE");

        // Click the Route segment.
        await page.locator(".webapp-nav-mode-seg--route").click();
        await expect(page.locator(".webapp-nav-mode-panel")).toHaveClass(/webapp-path-panel--ref/);
        // Neutral info: a wire exists but the chosen target is explicit.
        await expect(page.locator(".webapp-nav-mode-info")).toContainText("dient als Transport");

        // Pick the route + fill the :id value so the node is valid.
        await page.evaluate(() => {
            (window as unknown as { $: (s: string) => { val: (v?: string) => unknown } })
                .$("#node-input-route").val("ntRouteE");
            (window as unknown as { $: (s: string) => { trigger: (e: string) => unknown } })
                .$("#node-input-route").trigger("change");
        });
        await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { first: () => { typedInput: (...a: unknown[]) => unknown; trigger: (e: string) => unknown } } }).$;
            const $val = $(".webapp-nav-param-value").first();
            $val.typedInput("value", "42");
            $val.trigger("change");
        });
        await editor.save();
        await editor.deploy();

        // Reopen: mode stays "route" (stored intent wins over the still-present wire).
        await editor.openNode("ntActionE");
        await expect(page.locator("#node-input-targetMode")).toHaveValue("route");
    });

    // ── route mode mapping-table validation ───────────────────────────────────

    test("route mode: empty :placeholder value makes the node invalid; filling it makes it valid", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ntF", root: "ntF" })
            .node("ui-text", { id: "ntFHome", text: "Home" })
            .route({ id: "ntRouteF", path: "/customers/:id" })
            .node("ui-text", { id: "ntRouteFTxt", text: "Detail" })
            .build();
        // An unwired navigate action already in route mode pointing at the route.
        flow.push({
            type: "ui-action", id: "ntActionF", uiId: "ntActionF", name: "ntActionF",
            app: "ntF", actionType: "navigate", targetMode: "route", route: "ntRouteF",
            params: "", z: "e2e-flow", x: 100, y: 400, wires: [[]]
        });
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ntActionF");

        // Route mode active, mapping row for :id present, value empty → invalid.
        await expect(page.locator("#node-input-targetMode")).toHaveValue("route");
        await expect(page.locator(".webapp-nav-param-name")).toContainText(":id");
        expect(await editor.getValidationState("ntActionF")).toBe("invalid");

        // Fill the :id value via the typedInput → valid.
        await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { first: () => { typedInput: (...a: unknown[]) => unknown; trigger: (e: string) => unknown } } }).$;
            const $val = $(".webapp-nav-param-value").first();
            $val.typedInput("value", "payload.id");
            $val.trigger("change");
        });
        expect(await editor.getValidationState("ntActionF")).toBe("valid");
    });

    test("route mode: changing the route rebuilds the table, keeping same-named values", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ntG", root: "ntG" })
            .node("ui-text", { id: "ntGHome", text: "Home" })
            .route({ id: "ntGRoute1", path: "/customers/:id" })
            .node("ui-text", { id: "ntGRoute1Txt", text: "Cust" })
            .route({ id: "ntGRoute2", path: "/orders/:id/:tab" })
            .node("ui-text", { id: "ntGRoute2Txt", text: "Order" })
            .build();
        flow.push({
            type: "ui-action", id: "ntActionG", uiId: "ntActionG", name: "ntActionG",
            app: "ntG", actionType: "navigate", targetMode: "route", route: "ntGRoute1",
            params: JSON.stringify([{ name: "id", value: "payload.id", valueType: "msg" }]),
            z: "e2e-flow", x: 100, y: 400, wires: [[]]
        });
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ntActionG");

        // The route picker (P114 dialog field) lives INSIDE the coloured route
        // panel — its "Auswählen…" button sits in the route body.
        await expect(page.locator(".webapp-nav-route-body .webapp-picker-field-button")).toHaveCount(1);

        // Initially one row :id with the stored value.
        await expect(page.locator(".webapp-nav-param-name")).toHaveCount(1);

        // Switch the route to /orders/:id/:tab.
        await page.evaluate(() => {
            const $ = (window as unknown as { $: (s: string) => { val: (v?: string) => unknown; trigger: (e: string) => unknown } }).$;
            $("#node-input-route").val("ntGRoute2");
            $("#node-input-route").trigger("change");
        });
        // Two rows now: :id (kept) and :tab (new, empty).
        await expect(page.locator(".webapp-nav-param-name")).toHaveCount(2);
        const names = await page.locator(".webapp-nav-param-name").allTextContents();
        expect(names).toEqual([":id", ":tab"]);
    });

    // ── url mode ──────────────────────────────────────────────────────────────

    test("url mode shows the `to` typedInput and NO parameter section; soft warning on :placeholder", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ntH", root: "ntH" })
            .node("ui-text", { id: "ntHHome", text: "Home" })
            .build();
        flow.push({
            type: "ui-action", id: "ntActionH", uiId: "ntActionH", name: "ntActionH",
            app: "ntH", actionType: "navigate", targetMode: "url", to: "/customers/:id", toType: "str",
            z: "e2e-flow", x: 100, y: 400, wires: [[]]
        });
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("ntActionH");

        await expect(page.locator("#node-input-targetMode")).toHaveValue("url");
        // The `to` row is visible inside the url body; no mapping table.
        await expect(page.locator("#node-input-to-row")).toBeVisible();
        await expect(page.locator(".webapp-nav-param-name")).toHaveCount(0);
        // A str path with :placeholders triggers the soft warning (no block).
        await expect(page.locator(".webapp-nav-url-warn")).toContainText("Vermutlich ein Fehler");
        expect(await editor.getValidationState("ntActionH")).toBe("valid");
    });

    // P243 (ADR 0040): ui-navigation retired — navigation is solely a ui-action
    // navigate. The three-mode switcher is exercised on ui-action above; there is
    // no separate navigation node to align any more.
});
