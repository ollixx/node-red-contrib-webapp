import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P46 — per-node E2E specs for ui-query (state node).
 *
 * ui-query is a pass-through node that routes query request messages from the
 * browser into the wired Node-RED flow, and passes its output downstream. It
 * does not render a component itself.
 *
 * The full query lifecycle (browser event → query node → function node → store
 * update → SSE push → table update) requires a wired function node; that is the
 * customers-crud integration test. Here we test the node's isolated behaviour:
 *
 *   - A ui-table whose rows binding is a store (not a query) renders data that
 *     was injected into the store via a message wired through the query node.
 *   - The query node passes messages through to the next node in the flow.
 *   - A ui-table with a literal rows binding renders its rows regardless of query
 *     configuration — the query node does not interfere with unrelated bindings.
 */

test.describe("ui-query (P46)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── pass-through behaviour ───────────────────────────────────────────────

    test("query node passes injected messages through to a wired store, updating the table via SSE", async ({ page, request }) => {
        // Flow topology:
        //   inject → ui-query (wired output) → ui-store → (SSE push to client)
        //   ui-table rows bound to the store's statePath.
        //
        // We replicate the "query → store" pipeline entirely inside the spec:
        // the inject fires → query passes it through → store applies the update
        // → SSE pushes the new snapshot. We verify by checking the table content.

        const storeId = "qStoreNode1";
        const queryId = "qQueryNode1";
        const injectId = "qInj1";
        const funcId = "qFunc1";

        // Build a flow where inject → function (formats store msg) → query → store.
        // The query node is pass-through, so the formatted store message propagates
        // to the store node which applies the update.
        const flow = new FlowBuilder()
            .app({ id: "queryApp1", root: "queryApp1" })
            .node("ui-store", {
                id: storeId,
                statePath: "rows",
                initialValue: "[]"
            })
            .node("ui-query", {
                id: queryId,
                queryPath: "rows",
                // No mount — ui-query is not a visual node
                mount: undefined,
                wires: [[storeId]]
            })
            .node("ui-table", {
                id: "qTable1",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: { kind: "state", path: "rows" }
            })
            .build();

        // Add inject → function → query (→ store already wired above).
        const rowData = [{ id: "r1", name: "Alice" }];
        const funcCode = `msg.ui = { store: { id: "${storeId}", op: "replace", value: ${JSON.stringify(rowData)} } }; return msg;`;

        const allNodes = [
            ...flow,
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
                z: "e2e-flow",
                x: 100,
                y: 480,
                wires: [[funcId]]
            },
            {
                type: "function",
                id: funcId,
                name: funcId,
                func: funcCode,
                outputs: 1,
                z: "e2e-flow",
                x: 300,
                y: 480,
                wires: [[queryId]]
            }
        ];

        await deployFlow(request, allNodes);

        const webapp = new WebappPage(page, "queryApp1");
        await webapp.navigate("/");

        // Before inject: no rows.
        await expect(page.locator("table.webapp-table tbody")).toContainText("No rows loaded.");

        // Fire the inject → query passes through → store updates → SSE push.
        await injectMessage(request, injectId);

        // The SSE snapshot should update the table.
        await expect(page.locator("table.webapp-table tbody")).toContainText("Alice", { timeout: 5000 });
    });

    // ─── queryPath config is preserved ───────────────────────────────────────

    test("query node renders without error and table with literal rows shows data independently", async ({ page, request }) => {
        // Verify that deploying a ui-query node alongside a ui-table with literal
        // rows does not break rendering — the query node is inert unless messages
        // flow through it.
        const flow = new FlowBuilder()
            .app({ id: "queryApp2", root: "queryApp2" })
            .node("ui-query", {
                id: "qQueryNode2",
                queryPath: "items.list",
                mount: undefined
            })
            .node("ui-table", {
                id: "qTable2",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: {
                    kind: "literal",
                    value: [
                        { id: "a", name: "Alice" },
                        { id: "b", name: "Bob" }
                    ]
                }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "queryApp2");
        await webapp.navigate("/");

        // Literal rows render correctly regardless of the query node's presence.
        await expect(page.locator("table.webapp-table tbody")).toContainText("Alice");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Bob");
    });

    // ─── inject to query node directly ───────────────────────────────────────

    test("injecting directly to a query node (no downstream wiring) does not crash the runtime", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "queryApp3", root: "queryApp3" })
            .node("ui-query", {
                id: "qQueryNode3",
                queryPath: "data.list",
                mount: undefined
            })
            .node("ui-text", { id: "qText3", text: "Still alive" })
            .withInjectNode("qInj3", "qQueryNode3", { ui: { query: { queryPath: "data.list", refresh: true } } })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "queryApp3");
        await webapp.navigate("/");

        // Firing the inject should not crash — the query node passes through, no
        // downstream node handles it, which is a no-op.
        await injectMessage(request, "qInj3");

        // The page still renders correctly.
        await expect(webapp.root()).toContainText("Still alive");
    });
});
