import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P214 (ADR 0030) — a ui-query's IMPLICIT per-query params store.
 *
 * The paged loop of P161, but with NO manually-created / wired params store: the
 * query owns its params implicitly at `ui.queries.<queryPath>.params`, addressed
 * by the query's own node id. A `ui-store-action(store=<queryId>, set page)`
 * writes that slice, which fires the query's out-port refresh (P161 mechanism)
 * exactly as an explicit params store would.
 *
 *   1. a ui-query (queryPath=entities) with NO `params` field → implicit store;
 *   2. a wired "mock DB" reads `msg.ui.query.params.page`, returns that page's
 *      rows, and sends `msg.ui.query = { queryPath, data }` back to the IN-PORT;
 *   3. a ui-table binds `rows = query:entities` (bare path = the DATA);
 *   4. a ui-store-action referencing the QUERY id (store=<queryId>, op=set,
 *      path=page) writes the implicit params — driven by an inject (button stand-in).
 *
 * MEASURED on the rendered rows (owner's rule — not on tags/classes): initial
 * load shows page 1; firing the store-action with payload=2 makes the query
 * re-fetch page 2 and the table swaps Alice → Bob. No params store node exists in
 * the flow.
 */

const TAB_ID = "e2e-flow";

const PAGE_ONE = [{ id: "c1", name: "Alice" }];
const PAGE_TWO = [{ id: "c2", name: "Bob" }];

/**
 * The wired "mock DB": fires only on a TRIGGER (initial inject or the params
 * refresh). It reads the page out of `msg.ui.query.params.page` and returns the
 * matching rows on the query's IN-PORT. It DROPS any message that already carries
 * `data` (its own echoed return) so the fetch→data→fetch loop cannot form.
 */
function mockDbNode(id: string, queryNodeId: string, queryPath: string, y: number): NodeDef {
    const func =
        `var q = msg.ui && msg.ui.query;\n` +
        `if (q && Object.prototype.hasOwnProperty.call(q, "data")) { return null; }\n` +
        `var page = (q && q.params && q.params.page) || 1;\n` +
        `var rows = page >= 2 ? ${JSON.stringify(PAGE_TWO)} : ${JSON.stringify(PAGE_ONE)};\n` +
        `msg.ui = { query: { queryPath: ${JSON.stringify(queryPath)}, data: rows } };\n` +
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

/**
 * A "plain refresh" trigger: inject → function that builds
 * `msg.ui.query = { queryPath, refresh: true }` (NO params of its own) → wired to
 * the query's IN-PORT. Proves the query enriches the out-port emit with its
 * CURRENT params even when the triggering message carried none. Returns the
 * inject id to fire plus the two nodes.
 */
function plainRefreshNodes(injectId: string, queryNodeId: string, queryPath: string, y: number): NodeDef[] {
    const funcId = `${injectId}__fn`;
    return [
        {
            type: "inject",
            id: injectId,
            name: injectId,
            props: [{ p: "payload" }],
            repeat: "",
            crontab: "",
            once: false,
            onceDelay: "0.1",
            topic: "",
            payload: "",
            payloadType: "date",
            z: TAB_ID,
            x: 100,
            y,
            wires: [[funcId]]
        },
        {
            type: "function",
            id: funcId,
            name: funcId,
            func: `msg.ui = { query: { queryPath: ${JSON.stringify(queryPath)}, refresh: true } }; return msg;`,
            outputs: 1,
            z: TAB_ID,
            x: 300,
            y,
            wires: [[queryNodeId]]
        }
    ];
}

test.describe("ui-query implicit per-query params store (P214)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("writing the implicit params via ui-store-action(store=<queryId>) re-fetches the query — no params store node in the flow", async ({ page, request }) => {
        const appId = "ipsApp";
        const queryId = "ipsQuery";
        const actionId = "ipsAction";
        const dbId = "ipsDb";
        const queryPath = "entities";

        const builder = new FlowBuilder()
            .app({ id: appId, root: appId })
            // ui-query with NO `params` field → its implicit per-query params store
            // is the default. Its out-port is wired to the mock DB.
            .node("ui-query", {
                id: queryId,
                queryPath,
                wires: [[dbId]]
            })
            .node("ui-table", {
                id: "ipsTable",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: { kind: "query", path: queryPath }
            })
            // ui-store-action targeting the QUERY id — writes the implicit params
            // slice at ui.queries.entities.params. op=set, path=page, reference mode.
            .node("ui-store-action", {
                id: actionId,
                parent: appId,
                store: queryId,
                op: "set",
                path: "page",
                mode: "reference"
            })
            // Initial load (ADR 0016 §2 stand-in): fire the first fetch via the
            // query out-port.
            .withInjectNode("ipsInitial", queryId)
            // "Next Page" button stand-in: inject payload=2 → ui-store-action sets
            // the implicit params page=2 (value from msg.payload).
            .withInjectNode("ipsNext", actionId, 2);

        const nodes = [...builder.build(), mockDbNode(dbId, queryId, queryPath, 350)];

        // Guard: the flow contains NO ui-store node at all — the params store is
        // purely implicit.
        expect(nodes.some((n) => n.type === "ui-store")).toBe(false);

        await deployFlow(request, nodes);

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/");

        // Initial: nothing loaded yet.
        await expect(page.locator("table.webapp-table tbody")).toContainText("No rows loaded.");

        // Fire the initial load (out-port → mock DB returns page 1).
        await injectMessage(request, "ipsInitial");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Alice", { timeout: 5000 });
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Bob");

        // "Next Page": ui-store-action sets the implicit params page=2 → the query
        // observes its own params store → out-port refresh carrying params.page=2 →
        // mock DB returns page 2 → the table swaps to Bob.
        await injectMessage(request, "ipsNext");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Bob", { timeout: 5000 });
        // No loop: page-1 row is gone, replaced by page 2 (not appended forever).
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Alice");
    });

    test("a PLAIN refresh (no params in the message) carries the query's CURRENT params to the datasource", async ({ page, request }) => {
        const appId = "ipsApp2";
        const queryId = "ipsQuery2";
        const actionId = "ipsAction2";
        const dbId = "ipsDb2";
        const queryPath = "entities";

        const builder = new FlowBuilder()
            .app({ id: appId, root: appId })
            .node("ui-query", { id: queryId, queryPath, wires: [[dbId]] })
            .node("ui-table", {
                id: "ipsTable2",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: { kind: "query", path: queryPath }
            })
            // Sets the implicit params page=2 (and fires its own refresh).
            .node("ui-store-action", {
                id: actionId,
                parent: appId,
                store: queryId,
                op: "set",
                path: "page",
                mode: "reference"
            })
            .withInjectNode("ipsInitial2", queryId)
            .withInjectNode("ipsSetPage2", actionId, 2);

        const nodes = [
            ...builder.build(),
            mockDbNode(dbId, queryId, queryPath, 350),
            // The plain-refresh trigger: msg.ui.query = { queryPath, refresh:true }
            // with NO params → the query must enrich it with the stored page=2.
            ...plainRefreshNodes("ipsPlainRefresh", queryId, queryPath, 480)
        ];

        // Still no ui-store node — the params live only in the implicit slice.
        expect(nodes.some((n) => n.type === "ui-store")).toBe(false);

        await deployFlow(request, nodes);

        const webapp = new WebappPage(page, appId);
        await webapp.navigate("/");

        // Initial load → page 1 (Alice).
        await injectMessage(request, "ipsInitial2");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Alice", { timeout: 5000 });

        // Set page=2 (implicit params) → query re-fetches → Bob.
        await injectMessage(request, "ipsSetPage2");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Bob", { timeout: 5000 });

        // A PLAIN refresh carrying NO params of its own: the query attaches its
        // CURRENT params (page=2), so the datasource returns page 2 again → the
        // table STAYS Bob. Had the refresh reached the datasource WITHOUT params
        // (the pre-P214 gap), the mock DB would default to page 1 and flip to Alice.
        await injectMessage(request, "ipsPlainRefresh");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Bob", { timeout: 5000 });
        await expect(page.locator("table.webapp-table tbody")).not.toContainText("Alice");
    });
});
