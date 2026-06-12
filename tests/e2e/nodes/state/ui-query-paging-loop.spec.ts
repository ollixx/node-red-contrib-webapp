import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P161 — ui-query reactive paging loop (test-first).
 *
 * The full reactive loop (ADR 0016 §3 — declared `params` reference, no
 * auto-on-arrival):
 *   1. a `params`-store holds `{ page, pageSize }`;
 *   2. a ui-query declares `params` = that store and OBSERVES it; on change it
 *      emits a refresh `msg.ui.query` on its OUT-PORT (with the current params in
 *      `msg.ui.query.params`) and flips the lifecycle to `loading`;
 *   3. a wired "mock DB" reads `msg.ui.query.params.page`, returns that page's
 *      rows + `totalCount`, and sends `msg.ui.query = { queryPath, data, totalCount }`
 *      back to the query's IN-PORT;
 *   4. the query stores `data` + `totalCount` + `pageCount` under
 *      `ui.queries.<path>`;
 *   5. a ui-table binds `rows = query:list` (bare path = the DATA), a
 *      ui-pagination binds `total = query:list.pageCount` (the derived page
 *      count), a ui-text binds `query:list.loading`.
 *
 * Acceptance: initial load shows page 1; setting `page=2` in the store fires the
 * out-port refresh → mock DB returns page 2 → the table updates; NO loop (the
 * data return does not mutate the params); `query:list.pageCount` reaches the
 * pagination.
 */

const TAB_ID = "e2e-flow";

const PAGE_ONE = [{ id: "c1", name: "Alice" }];
const PAGE_TWO = [{ id: "c2", name: "Bob" }];
const TOTAL_COUNT = 42;
const PAGE_SIZE = 10;
const PAGE_COUNT = Math.ceil(TOTAL_COUNT / PAGE_SIZE); // 5

/**
 * The wired "mock DB": fires only on a TRIGGER — the initial `onEnter`-style
 * inject (no `msg.ui.query`) or a params-store refresh (`msg.ui.query.refresh`).
 * It reads the page out of the refresh msg (`msg.ui.query.params.page`) and
 * returns the matching page + totalCount + pageCount on the query's IN-PORT.
 *
 * Crucially it IGNORES its own data return: the query's in-port handler passes
 * the data message back out the query's out-port (so downstream wiring works),
 * and that echo carries `msg.ui.query.data`. A real fetch node does not re-fetch
 * on a result it just produced — so this mock drops any message that already
 * carries `data`. That is what prevents the fetch→data→fetch loop (ADR 0016: the
 * data return must not re-trigger the fetch).
 *
 * `totalCount` (item count) and `pageCount` (derived page count) are the
 * reserved query-lifecycle metadata a ui-pagination binds via
 * `query:<path>.totalCount` / `query:<path>.pageCount`.
 */
function mockDbNode(id: string, queryNodeId: string, queryPath: string, y: number): NodeDef {
    const func =
        `var q = msg.ui && msg.ui.query;\n` +
        `if (q && Object.prototype.hasOwnProperty.call(q, "data")) { return null; }\n` +
        `var page = (q && q.params && q.params.page) || 1;\n` +
        `var rows = page >= 2 ? ${JSON.stringify(PAGE_TWO)} : ${JSON.stringify(PAGE_ONE)};\n` +
        `msg.ui = { query: { queryPath: ${JSON.stringify(queryPath)}, data: rows, totalCount: ${TOTAL_COUNT}, pageCount: ${PAGE_COUNT} } };\n` +
        `return msg;`;
    return {
        type: "function",
        id,
        name: id,
        func,
        outputs: 1,
        z: TAB_ID,
        x: 520,
        y,
        wires: [[queryNodeId]]
    };
}

test.describe("ui-query reactive paging loop (P161)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("params-store change fires an out-port refresh carrying params; mock DB returns the new page; totalCount reaches the pagination; no loop", async ({ page, request }) => {
        const appId = "plApp";
        const queryId = "plQuery";
        const storeId = "plParams";
        const dbId = "plDb";
        const queryPath = "list";

        const builder = new FlowBuilder()
            .app({ id: appId, root: appId })
            // params store {page, pageSize}; the query's `params` points at it.
            .node("ui-store", {
                id: storeId,
                statePath: "params",
                initialValue: JSON.stringify({ page: 1, pageSize: 10 })
            })
            // ui-query OBSERVES the params store and emits a refresh on its
            // OUT-PORT → wired to the mock DB.
            .node("ui-query", {
                id: queryId,
                queryPath,
                params: storeId,
                wires: [[dbId]]
            })
            .node("ui-table", {
                id: "plTable",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: { kind: "query", path: queryPath }
            })
            .node("ui-pagination", {
                id: "plPager",
                total: { kind: "query", path: `${queryPath}.pageCount` },
                currentPage: { kind: "state", path: "params.page" }
            })
            .node("ui-text", {
                id: "plLoading",
                value: { kind: "query", path: `${queryPath}.loading` }
            })
            // Initial load (ADR 0016 §2 prerequisite): an inject fires the first
            // fetch via the query out-port (stand-in for the route onEnter wire).
            .withInjectNode("plInitial", queryId);

        // "Next Page": set page=2 in the params store. This is the visible cause
        // the query reacts to (ADR 0016 §3).
        builder.withStoreInject("plNext", storeId, { page: 2, pageSize: 10 }, storeId);

        const nodes = [...builder.build(), mockDbNode(dbId, queryId, queryPath, 350)];

        await deployFlow(request, nodes);

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/");

        // Initial: nothing loaded yet.
        await expect(page.locator("table.webapp-table tbody")).toContainText("No rows loaded.");

        // Fire the initial load (out-port → mock DB returns page 1).
        await injectMessage(request, "plInitial");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Alice", { timeout: 5000 });
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Bob");

        // pageCount reached the pagination (42 items / 10 per page = 5 pages).
        await expect(page.locator(".webapp-pagination-page")).toContainText(`/ ${PAGE_COUNT}`, { timeout: 5000 });

        // "Next Page": page=2 in the store → query observes the change → out-port
        // refresh carrying params.page=2 → mock DB returns page 2 → table updates.
        await injectMessage(request, "plNext");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Bob", { timeout: 5000 });
        // No loop: the page-1 row is gone, replaced by page 2 (not appended forever).
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Alice");
    });
});
