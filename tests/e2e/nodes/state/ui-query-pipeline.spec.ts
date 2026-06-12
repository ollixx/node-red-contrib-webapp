import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow, type NodeDef } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P160 — ui-query DATA pipeline (test-first).
 *
 * The wired data flow that a ui-query is meant to carry:
 *   inject (msg.payload) → function (build msg.ui.query) → ui-query (persist) →
 *   ui.queries.<queryPath> → a bound ui-table (rows = query:<path>) shows it.
 *
 * Unlike the P46 spec — which routes query data through a STORE and only proves
 * the node is pass-through — this spec exercises the genuine `query:` binding
 * pipeline end to end:
 *   1. a `data` push lands under the query path and fills a bound ui-table;
 *   2. a second push updates the table live (SSE), no reload;
 *   3. an `error` push surfaces on a `query:<path>.error`-bound ui-text.
 */

const TAB_ID = "e2e-flow";

/** An inject → function pair that pushes `msg.ui.query = {queryPath, ...fields}`. */
function queryPushInject(
    injectId: string,
    queryNodeId: string,
    queryPath: string,
    fields: Record<string, unknown>,
    y: number
): NodeDef[] {
    const funcId = `${injectId}__fn`;
    const queryObj = JSON.stringify({ queryPath, ...fields });
    const funcCode = `msg.ui = { query: ${queryObj} }; return msg;`;
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
            func: funcCode,
            outputs: 1,
            z: TAB_ID,
            x: 320,
            y,
            wires: [[queryNodeId]]
        }
    ];
}

test.describe("ui-query data pipeline (P160)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("a wired msg.ui.query.data push fills a query-bound ui-table, updates live, and an error push shows on a query:<path>.error-bound ui-text", async ({ page, request }) => {
        const queryId = "qpQuery";
        const queryPath = "customers.list";

        const flow = new FlowBuilder()
            .app({ id: "qpApp", root: "qpApp" })
            .node("ui-query", {
                id: queryId,
                queryPath,
                mount: undefined
            })
            .node("ui-table", {
                id: "qpTable",
                columns: JSON.stringify([{ key: "name", label: "Name" }]),
                rows: { kind: "query", path: queryPath }
            })
            .node("ui-text", {
                id: "qpError",
                value: { kind: "query", path: `${queryPath}.error` }
            })
            .build();

        const firstData = [{ id: "c1", name: "Alice" }];
        const secondData = [
            { id: "c1", name: "Alice" },
            { id: "c2", name: "Bob" }
        ];

        const nodes = [
            ...flow,
            ...queryPushInject("qpPush1", queryId, queryPath, { data: firstData }, 480),
            ...queryPushInject("qpPush2", queryId, queryPath, { data: secondData }, 540),
            ...queryPushInject("qpPushErr", queryId, queryPath, { error: "Load failed" }, 600)
        ];

        await deployFlow(request, nodes);

        const webapp = new WebappPage(page, "qpApp");
        await webapp.navigate("/");

        // Before any push: the table has no query data.
        await expect(page.locator("table.webapp-table tbody")).toContainText("No rows loaded.");

        // 1. First data push → table fills via SSE.
        await injectMessage(request, "qpPush1");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Alice", { timeout: 5000 });

        // 2. Second push updates live — Bob appears without a reload.
        await injectMessage(request, "qpPush2");
        await expect(page.locator("table.webapp-table tbody")).toContainText("Bob", { timeout: 5000 });

        // 3. An error push surfaces on the query:<path>.error-bound ui-text.
        await injectMessage(request, "qpPushErr");
        await expect(webapp.root()).toContainText("Load failed", { timeout: 5000 });
    });
});
