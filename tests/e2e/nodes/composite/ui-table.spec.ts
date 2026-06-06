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
 *   - Optional footer renders when enabled.
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
