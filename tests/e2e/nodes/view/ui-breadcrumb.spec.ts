import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P95 — ui-breadcrumb redesign: fresh E2E tests per node-testing.md.
 *
 * Covers (outcome-based, not mere DOM presence):
 *  1. Renders sl-breadcrumb with correct item count (object items).
 *  2. String items render correctly (label visible + click dispatches action).
 *  3. Object items: label renders, action dispatched on click.
 *  4. Active item has aria-current="page" and is still clickable.
 *  5. Item without explicit action defaults action to label.
 *  6. All items emit click event (no positional selectivity — last item clickable too).
 *  7. Empty items array → sl-breadcrumb with zero items (sibling still renders).
 *
 * See tests/e2e/nodes/view/ui-breadcrumb.tests.md for the test catalogue.
 */

test.describe("ui-breadcrumb (P95)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ── 1. Basic rendering ──────────────────────────────────────────────────
    test("renders sl-breadcrumb with correct number of items (object items)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcApp1", root: "bcApp1" })
            .node("ui-breadcrumb", {
                id: "bcNode1",
                items: [
                    { label: "Home", action: "/" },
                    { label: "Customers", action: "/customers" },
                    { label: "Details", active: true }
                ]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcApp1");
        await webapp.navigate("/");
        await expect(page.locator("sl-breadcrumb")).toBeVisible();
        await expect(page.locator("sl-breadcrumb-item")).toHaveCount(3);
    });

    // ── 2. String items ─────────────────────────────────────────────────────
    test("string items: renders label text and dispatches string as action on click", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcStr1", root: "bcStr1" })
            .node("ui-breadcrumb", {
                id: "bcStrNode1",
                items: ["Home", "Customers", "Details"]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcStr1");
        await webapp.navigate("/");

        await expect(page.locator("sl-breadcrumb")).toContainText("Home");
        await expect(page.locator("sl-breadcrumb")).toContainText("Customers");

        // Click first item — action value should equal the string "Home"
        const eventPromise = webapp.interceptNextEvent();
        await page.locator("sl-breadcrumb-item[data-webapp-breadcrumb-action='Home']").click();
        const body = await eventPromise;
        expect(body.event).toBe("click");
        expect(body.sourceId).toBe("bcStrNode1");
        expect((body.params as Record<string, unknown>).action).toBe("Home");
    });

    // ── 3. Object items — action dispatched ────────────────────────────────
    test("object items: click dispatches {event:click, params:{action}}", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcObj1", root: "bcObj1" })
            .node("ui-breadcrumb", {
                id: "bcObjNode1",
                items: [
                    { label: "Home", action: "/" },
                    { label: "Customers", action: "/customers" }
                ]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcObj1");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("sl-breadcrumb-item[data-webapp-breadcrumb-action='/customers']").click();
        const body = await eventPromise;
        expect(body.event).toBe("click");
        expect(body.sourceId).toBe("bcObjNode1");
        expect((body.params as Record<string, unknown>).action).toBe("/customers");
    });

    // ── 4. Active item ─────────────────────────────────────────────────────
    test("active item has aria-current=page in DOM and is still clickable", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcAct1", root: "bcAct1" })
            .node("ui-breadcrumb", {
                id: "bcActNode1",
                items: [
                    { label: "Home", action: "/" },
                    { label: "Current", action: "/cur", active: true }
                ]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcAct1");
        await webapp.navigate("/");

        // Active item carries aria-current=page
        const activeItem = page.locator("sl-breadcrumb-item[aria-current='page']");
        await expect(activeItem).toHaveCount(1);
        await expect(activeItem).toContainText("Current");

        // Active item still clickable (P95 design — no positional exclusion)
        const eventPromise = webapp.interceptNextEvent();
        await activeItem.click();
        const body = await eventPromise;
        expect(body.event).toBe("click");
        expect((body.params as Record<string, unknown>).action).toBe("/cur");
    });

    // ── 5. Item without action defaults to label ───────────────────────────
    test("item without explicit action: label is used as action", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcDef1", root: "bcDef1" })
            .node("ui-breadcrumb", {
                id: "bcDefNode1",
                items: [{ label: "Section" }, { label: "Detail" }]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcDef1");
        await webapp.navigate("/");

        const firstItem = page.locator("sl-breadcrumb-item[data-webapp-breadcrumb-action='Section']");
        await expect(firstItem).toHaveCount(1);

        const eventPromise = webapp.interceptNextEvent();
        await firstItem.click();
        const body = await eventPromise;
        expect((body.params as Record<string, unknown>).action).toBe("Section");
    });

    // ── 6. All items clickable — no positional exclusion ───────────────────
    test("last item is also clickable (no positional selectivity in P95)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcLast1", root: "bcLast1" })
            .node("ui-breadcrumb", {
                id: "bcLastNode1",
                items: [
                    { label: "First", action: "first" },
                    { label: "Last", action: "last" }
                ]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcLast1");
        await webapp.navigate("/");

        const lastItem = page.locator("sl-breadcrumb-item[data-webapp-breadcrumb-action='last']");
        await expect(lastItem).toHaveCount(1);

        const eventPromise = webapp.interceptNextEvent();
        await lastItem.click();
        const body = await eventPromise;
        expect(body.event).toBe("click");
        expect((body.params as Record<string, unknown>).action).toBe("last");
    });

    // ── 7. Empty items ──────────────────────────────────────────────────────
    test("empty items array → sl-breadcrumb with zero items (sibling still renders)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcEmp1", root: "bcEmp1" })
            .node("ui-breadcrumb", { id: "bcEmpNode1", items: [] })
            .node("ui-text", { id: "bcSib1", text: "Sibling" })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcEmp1");
        await webapp.navigate("/");
        // Outcome: the breadcrumb container is rendered but carries NO items, and
        // the sibling text still renders (empty items neither drop the element nor
        // break the surrounding layout). Goes red if empty items emit stray items
        // or break the render.
        await expect(page.locator("sl-breadcrumb")).toHaveCount(1);
        await expect(page.locator("sl-breadcrumb sl-breadcrumb-item")).toHaveCount(0);
        await expect(webapp.root()).toContainText("Sibling");
    });

    // ── 8. separator string (P248) ─────────────────────────────────────────
    // MEASURED: a non-empty `separator` string overrides Shoelace's native "/"
    // by rendering as slot="separator" content. Using a DISTINCTIVE non-default
    // char (">") proves the field actually drives the rendered separator (goes
    // red if the string were inert — the old behaviour, where props.separator was
    // dropped before the serializer and never emitted).
    test("separator string renders as slot=separator content (overrides native '/')", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcSep1", root: "bcSep1" })
            .node("ui-breadcrumb", {
                id: "bcSepNode1",
                items: [
                    { label: "Home", action: "/" },
                    { label: "Customers", action: "/customers" },
                    { label: "Details", active: true }
                ],
                separator: ">"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcSep1");
        await webapp.navigate("/");

        await expect(page.locator("sl-breadcrumb")).toBeVisible();
        // The light-DOM slotted separator element is present exactly once (Shoelace
        // clones it into every gap) and carries our custom string — NOT the native "/".
        const sep = page.locator("sl-breadcrumb > span[slot='separator']");
        await expect(sep).toHaveCount(1);
        await expect(sep).toHaveText(">");
        // Items still render unaffected.
        await expect(page.locator("sl-breadcrumb-item")).toHaveCount(3);
    });

    // Control: no separator prop → no slotted separator element (Shoelace falls
    // back to its native "/"). Confirms the slot is only emitted when the string
    // is set — i.e. the field's effect is genuinely value-driven, not always-on.
    test("no separator prop → no slot=separator element (Shoelace native default)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcSep2", root: "bcSep2" })
            .node("ui-breadcrumb", {
                id: "bcSepNode2",
                items: [{ label: "Home", action: "/" }, { label: "Customers", action: "/customers" }]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcSep2");
        await webapp.navigate("/");

        await expect(page.locator("sl-breadcrumb")).toBeVisible();
        await expect(page.locator("sl-breadcrumb > span[slot='separator']")).toHaveCount(0);
    });

    // ── 9. route/path item fires click, NOT navigate (P248) ────────────────
    // MEASURED navigate-truth lock: the P95 design collapsed all breadcrumb
    // interactions to `click`. Even an item whose action is a ROUTE PATH
    // ("/customers") emits `click` — the node never fires `navigate` itself
    // (navigation is done by wiring click → ui-action navigate). The schema still
    // TOLERATES events:["navigate"] as P75 back-compat, but the runtime emits only
    // click. This test measures the real envelope for a route/path item.
    test("route/path item fires click (not navigate) with correct msg.ui envelope", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "bcNav1", root: "bcNav1" })
            .node("ui-breadcrumb", {
                id: "bcNavNode1",
                items: [
                    { label: "Home", action: "/" },
                    { label: "Customers", action: "/customers" }
                ]
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "bcNav1");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator("sl-breadcrumb-item[data-webapp-breadcrumb-action='/customers']").click();
        const body = await eventPromise;
        // Real behaviour: click, NOT navigate.
        expect(body.event).toBe("click");
        expect(body.event).not.toBe("navigate");
        expect(body.sourceId).toBe("bcNavNode1");
        expect((body.params as Record<string, unknown>).action).toBe("/customers");
    });
});
