import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P45 — per-node E2E specs for ui-table (composite node).
 *
 * Covers:
 *   - columns + rows render as <table> with correct header/cell content.
 *   - Row click → POST /event { event:"rowSelect", params:{ rowId } }.
 *   - Input port: inject new rows array → table updates via SSE.
 *   - selectAction (P249): a configured selectAction makes the row selectable and
 *     is carried on the rendered rowSelect link as data-webapp-action.
 *
 * P249 (conformance): the inert `footer` field and the inert secondary events
 * `rowAction`/`checkboxChange`/`cellSelect` were REMOVED from schema + spec — no
 * DOM source ever rendered them, so there is nothing to E2E. `rowSelect` and
 * `selectAction` are the only interactive surfaces and are proven below.
 */

test.describe("ui-table (P45)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("columns render as <th> header cells", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblApp1", root: "tblApp1" })
            .node("ui-table", {
                id: "tblNode1",
                columns: JSON.stringify([
                    { key: "name", label: "Name" },
                    { key: "city", label: "City" }
                ])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblApp1");
        await webapp.navigate("/");

        await expect(page.locator("table.webapp-table thead th").nth(0)).toContainText("Name");
        await expect(page.locator("table.webapp-table thead th").nth(1)).toContainText("City");
    });

    test("rows render as <td> cells with correct values", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblApp2", root: "tblApp2" })
            .node("ui-table", {
                id: "tblNode2",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: {
                    kind: "literal",
                    value: [
                        { id: "r1", name: "Alice" },
                        { id: "r2", name: "Bob" }
                    ]
                }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblApp2");
        await webapp.navigate("/");

        const rows = page.locator("table.webapp-table tbody tr");
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toContainText("Alice");
        await expect(rows.nth(1)).toContainText("Bob");
    });

    test("empty table shows 'No rows loaded.' message", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblApp3", root: "tblApp3" })
            .node("ui-table", {
                id: "tblNode3",
                columns: JSON.stringify([{ key: "name", label: "Name" }])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblApp3");
        await webapp.navigate("/");

        await expect(page.locator("table.webapp-table tbody")).toContainText("No rows loaded.");
    });

    // P158 (ADR 0012): `rows` is the canonical STRUCTURAL array DATA SOURCE — the
    // SAME structural-array case as ui-select `options` (P133) / ui-menu `items`
    // (P157). A bound store slice that is legitimately an array of row records must
    // keep its shape (not be coerced by the display-scalar guard). The table
    // renders its rows itself; `columns` stays separate.
    test("store-array rows render the table rows reactively", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblStoreApp", root: "tblStoreApp" })
            .node("ui-store", {
                id: "tblRowsStore",
                statePath: "people",
                initialValue: JSON.stringify([
                    { id: "p1", name: "Eve" },
                    { id: "p2", name: "Frank" }
                ])
            })
            .node("ui-table", {
                id: "tblStoreNode",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                // store binding: path = the ui-store NODE id; the whole array slice
                // is read structurally (not coerced by the display-scalar guard).
                rows: { kind: "store", path: "tblRowsStore" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblStoreApp");
        await webapp.navigate("/");

        const rows = page.locator("table.webapp-table tbody tr");
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toContainText("Eve");
        await expect(rows.nth(1)).toContainText("Frank");
    });

    // P158: a legacy `rowsPath` plain state path migrates to a `{ kind:"state" }`
    // binding and the table renders its rows from that store slice — verifying the
    // rename + migration is loss-free (so customers-crud keeps working unchanged).
    test("legacy rowsPath migrates to a state binding and renders rows", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblMigApp", root: "tblMigApp" })
            .node("ui-store", {
                id: "tblMigStore",
                statePath: "data",
                initialValue: JSON.stringify({ list: [{ id: "g1", name: "Grace" }] })
            })
            .node("ui-table", {
                id: "tblMigNode",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                // legacy plain state-path field — migrates to { kind:"state", path }.
                // P229: the FlowBuilder default now emits the canonical `rows`
                // binding; suppress it so the legacy field is the only source.
                rowsPath: "data.list",
                rows: undefined
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblMigApp");
        await webapp.navigate("/");

        await expect(page.locator("table.webapp-table tbody tr").first()).toContainText("Grace");
    });

    // ─── events — row select ─────────────────────────────────────────────────

    test("row click → POST /event with event='rowSelect' and params.rowId", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblApp4", root: "tblApp4" })
            .node("ui-table", {
                id: "tblNode4",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: {
                    kind: "literal",
                    value: [{ id: "r42", name: "Alice" }]
                },
                events: JSON.stringify(["rowSelect"])
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblApp4");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();

        // The selectable row renders a link in the first cell.
        await page.locator("table.webapp-table tbody tr td a.webapp-link").click();

        const body = await eventPromise;
        expect(body.event).toBe("rowSelect");
        expect((body.params as Record<string, unknown>).rowId).toBe("r42");
    });

    // ─── selectAction (P249) — the configured action is carried ──────────────

    // P249: `selectAction` (deprecated but still wired) makes a row selectable even
    // without `events:[rowSelect]`, and the rendered first-cell link carries the
    // action as data-webapp-action so the legacy no-events flow keeps working.
    test("configured selectAction makes the row selectable and is carried on the link", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblApp6", root: "tblApp6" })
            .node("ui-table", {
                id: "tblNode6",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: {
                    kind: "literal",
                    value: [{ id: "r7", name: "Alice" }]
                },
                // No `events` — selectAction alone must drive selectability.
                selectAction: "openCustomerDetail"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblApp6");
        await webapp.navigate("/");

        // The row renders a selectable link carrying the configured action.
        const link = page.locator("table.webapp-table tbody tr td a.webapp-link");
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute("data-webapp-action", "openCustomerDetail");
        await expect(link).toHaveAttribute("data-webapp-event", "rowSelect");
        await expect(link).toHaveAttribute("data-webapp-rowid", "r7");

        // And clicking it still emits a rowSelect envelope (selectAction is a
        // client-side action hint; the reported event type stays rowSelect).
        const eventPromise = webapp.interceptNextEvent();
        await link.click();
        const body = await eventPromise;
        expect(body.event).toBe("rowSelect");
        expect((body.params as Record<string, unknown>).rowId).toBe("r7");
    });

    // ─── input port — rows update via inject ─────────────────────────────────

    test("inject new rows → table updates after navigate", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "tblApp5", root: "tblApp5" })
            .node("ui-table", {
                id: "tblNode5",
                columns: JSON.stringify([{ key: "name", label: "Name" }])
            })
            .withInjectNode("tblInj5", "tblNode5", [
                { id: "r1", name: "Charlie" },
                { id: "r2", name: "Diana" }
            ])
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "tblApp5");
        await webapp.navigate("/");

        // Before inject: no rows
        await expect(page.locator("table.webapp-table tbody")).toContainText("No rows loaded.");

        await injectMessage(request, "tblInj5");

        // Re-navigate to pick up the patched in-memory rows.
        await webapp.navigate("/");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Charlie");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Diana");
    });
});
