/**
 * ui-query → ui-list showcase spec (P187, ADR 0022 §2).
 *
 * Pilot showcase for the full data path:
 *   route onEnter → inject msg.ui.query → ui-query node → ui-list (query binding).
 *
 * Named `test.step` chapters walk through:
 *   1. Initial loading state: ui-list is empty before a query push.
 *   2. Data state: after a query push the list fills with items via SSE.
 *   3. Live update: a second push replaces the item set without a reload.
 *   4. Config-dialog cameo: ui-query queryPath field visible in the editor.
 *
 * Produces a readable review video under SHOWCASE=1 (P186).
 * See `tests/e2e/showcase/showcase-helpers.ts` for the pattern docs.
 */

import { expect, test } from "@playwright/test";

import { FlowBuilder, ShowcaseFlow, deployFlow, resetFlow, type NodeDef } from "./showcase-helpers";
import { injectMessage } from "../../helpers/admin-api";

const TAB_ID = "e2e-flow";
const APP_ID = "queryListShowcaseApp";
const QUERY_ID = "queryListQuery";
const QUERY_PATH = "products.list";

/** Helper: build an inject + function pair that pushes `msg.ui.query` to the query node. */
function queryPush(
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
        } as NodeDef,
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
        } as NodeDef
    ];
}

/** Products shown after the first query push. */
const FIRST_PRODUCTS = [
    { id: "p1", label: "Laptop", value: 2, icon: "laptop" },
    { id: "p2", label: "Headphones", value: 5, icon: "headphones" }
];

/** Expanded product set pushed in the live-update step. */
const UPDATED_PRODUCTS = [
    { id: "p1", label: "Laptop", value: 2, icon: "laptop" },
    { id: "p2", label: "Headphones", value: 5, icon: "headphones" },
    { id: "p3", label: "Keyboard", value: 9, icon: "keyboard" }
];

test.describe("ui-query → ui-list showcase (P187)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("ui-query → ui-list feature tour", async ({ page, request }) => {
        const sf = new ShowcaseFlow(page, request);

        // Build a self-contained flow:
        //   ui-app
        //     ui-query  (queryPath = "products.list")
        //     ui-list   (items bound to query:products.list)
        //   inject+function  →  ui-query  (simulates a route-onEnter fetch)
        const baseFlow = new FlowBuilder()
            .app({ id: APP_ID, root: APP_ID })
            .node("ui-query", {
                id: QUERY_ID,
                queryPath: QUERY_PATH,
                // ui-query has no visible mount — omit mount to avoid FlowBuilder defaulting.
                mount: undefined
            })
            .node("ui-list", {
                id: "queryListList",
                items: { kind: "query", path: QUERY_PATH },
                displayValue: "badge",
                badgeVariant: "primary",
                displayType: "divided",
                events: JSON.stringify(["itemClick"])
            })
            .build();

        const flow: NodeDef[] = [
            ...baseFlow,
            ...queryPush("queryListPush1", QUERY_ID, QUERY_PATH, { data: FIRST_PRODUCTS }, 480),
            ...queryPush("queryListPush2", QUERY_ID, QUERY_PATH, { data: UPDATED_PRODUCTS }, 540)
        ];

        await sf.deploy(flow);
        const app = await sf.openApp(APP_ID);
        const items = page.locator("ul.webapp-list li.webapp-list-item");

        // ── Step 1: Initial loading state — list is empty ─────────────────────
        await test.step("Step 1 — initial state: query has no data yet → list is empty", async () => {
            // Before any push the query binding resolves to no data → 0 items.
            await expect(items).toHaveCount(0);
            // The list root is still rendered (no crash / no missing element).
            await expect(page.locator("ul.webapp-list")).toBeVisible();
        });

        // ── Step 2: Data state — push fills the list via SSE ──────────────────
        await test.step("Step 2 — after first query push → list fills via SSE", async () => {
            await injectMessage(request, "queryListPush1");
            await expect(items).toHaveCount(2, { timeout: 5000 });
            await expect(items.nth(0)).toContainText("Laptop");
            await expect(items.nth(1)).toContainText("Headphones");
            // Badges carry the per-item value.
            const badges = page.locator("ul.webapp-list li sl-badge.webapp-list-value");
            await expect(badges).toHaveCount(2);
            await expect(badges.nth(0)).toContainText("2");
        });

        // ── Step 3: Live update — second push replaces the item set ───────────
        await test.step("Step 3 — second push updates the list live (no reload)", async () => {
            await injectMessage(request, "queryListPush2");
            await expect(items).toHaveCount(3, { timeout: 5000 });
            await expect(items.nth(2)).toContainText("Keyboard");
            // The first two items are still there (not wiped on update).
            await expect(items.nth(0)).toContainText("Laptop");
        });

        // ── Step 4: itemClick event from query-bound list ─────────────────────
        await test.step("Step 4 — itemClick from query-bound list emits correct params", async () => {
            const eventPromise = app.interceptNextEvent();
            await page.locator("ul.webapp-list li", { hasText: "Keyboard" }).locator("a.webapp-link").click();
            const body = await eventPromise;
            expect(body.event).toBe("itemClick");
            const params = body.params as Record<string, unknown>;
            expect(params.rowId).toBe("p3");
            const row = params.row as Record<string, unknown>;
            expect(row.label).toBe("Keyboard");
        });

        // ── Step 5: Config-dialog cameo — ui-query editor panel ───────────────
        await test.step("Step 5 — config dialog: ui-query queryPath field visible in editor", async () => {
            await sf.openEditor(["ui-query", "ui-list", "ui-app"]);
            await sf.openNodeConfig(QUERY_ID);
            // The queryPath field must be present in the config dialog.
            await expect(page.locator("#node-input-queryPath")).toHaveCount(1);
            await sf.closeNodeConfig();
        });

        void app; // used in step 4
    });
});
