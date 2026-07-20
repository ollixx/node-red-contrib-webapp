import { expect, test } from "@playwright/test";

import { deployFlow, injectMessage, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { WebappPage } from "../../../helpers/webapp-page";

/**
 * P154 — per-node E2E specs for ui-pagination (ADR 0012 field-typing wave 2).
 *
 * `totalPath` → `total` (read-only value typedInput) and `currentPagePath` →
 * `currentPage` (TWO-WAY value typedInput: reads the live page from the bound
 * store/state AND, on a page click, emits the `change` event carrying the new
 * page so a wired flow writes it back to that store) — plus the existing
 * pageChange event. `pageSize` stays a config number.
 *
 * Covers (see tests/e2e/nodes/view/ui-pagination.tests.md):
 *   R01      rendering: prev/next buttons + page label.
 *   T01–T02  total binding: literal + state binding drives the "/ total" label.
 *   C01      currentPage state binding sets the initial active page.
 *   C02      currentPage two-way write-back: page click → change event → wired
 *            store set → SSE re-render moves the active page.
 *   C03      external store change → SSE re-render sets the active page.
 *   E01      pageChange event: click emits change with params.page.
 *   M01–M02  migration: legacy totalPath / currentPagePath plain paths still work.
 *
 * NOTE: do not run this file with the Playwright CLI in a worktree — the
 * orchestrator runs the full E2E suite on the merged develop branch.
 */

test.describe("ui-pagination (P154)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    // ─── rendering ───────────────────────────────────────────────────────────

    test("R01 — renders prev/next buttons and the page label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg154R1App", root: "pg154R1App" })
            .node("ui-pagination", {
                id: "pg154R1",
                currentPage: { kind: "literal", value: 2 },
                total: { kind: "literal", value: 5 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154R1App");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-pagination")).toBeVisible();
        await expect(page.locator(".webapp-pagination sl-button")).toHaveCount(2);
        await expect(page.locator(".webapp-pagination-page")).toContainText("2 / 5");
    });

    // ─── total binding (read-only) ───────────────────────────────────────────

    test("T01 — total literal binding drives the '/ total' label", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg154T1App", root: "pg154T1App" })
            .node("ui-pagination", {
                id: "pg154T1",
                currentPage: { kind: "literal", value: 3 },
                total: { kind: "literal", value: 12 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154T1App");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-pagination-page")).toContainText("3 / 12");
    });

    test("T02 — total state binding resolves the page count from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg154T2App", root: "pg154T2App" })
            .node("ui-store", {
                id: "pg154T2Store",
                statePath: "list",
                initialValue: JSON.stringify({ page: 1, total: 7 })
            })
            .node("ui-pagination", {
                id: "pg154T2",
                currentPage: { kind: "state", path: "list.page" },
                total: { kind: "state", path: "list.total" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154T2App");
        await webapp.navigate("/");
        // total resolved from the store slice (7) — read-only source.
        await expect(page.locator(".webapp-pagination-page")).toContainText("1 / 7");
    });

    // ─── currentPage binding (two-way) ───────────────────────────────────────

    test("C01 — currentPage state binding sets the initial active page", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg154C1App", root: "pg154C1App" })
            .node("ui-store", {
                id: "pg154C1Store",
                statePath: "list",
                initialValue: JSON.stringify({ page: 4, total: 9 })
            })
            .node("ui-pagination", {
                id: "pg154C1",
                currentPage: { kind: "state", path: "list.page" },
                total: { kind: "state", path: "list.total" }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154C1App");
        await webapp.navigate("/");
        // currentPage read from the store → active page 4.
        await expect(page.locator(".webapp-pagination-page")).toContainText("4 / 9");
    });

    test("C02 — two-way write-back: page click → change event → wired store set → active page moves", async ({ page, request }) => {
        // A function node converts the pagination `change` event into a store
        // `set` of list.page = params.page (the documented store-roundtrip wiring).
        // The pagination's currentPage binding reads from the SAME store slice, so
        // the SSE re-render moves the active page — the two-way loop closes.
        const writeBackFnId = "pg154C2Fn";
        const flow = new FlowBuilder()
            .app({ id: "pg154C2App", root: "pg154C2App" })
            .node("ui-store", {
                id: "pg154C2Store",
                statePath: "list",
                initialValue: JSON.stringify({ page: 2, total: 6 })
            })
            .node("ui-pagination", {
                id: "pg154C2",
                currentPage: { kind: "state", path: "list.page" },
                total: { kind: "state", path: "list.total" },
                // Wire the change event out-port to the write-back function.
                wires: [[writeBackFnId]]
            })
            .build();

        // Append the write-back function: change event → ui.store.set list.page.
        flow.push({
            type: "function",
            id: writeBackFnId,
            name: writeBackFnId,
            func: 'msg.ui = { store: { id: "pg154C2Store", op: "set", path: "page", value: msg.ui.params.page } }; return msg;',
            outputs: 1,
            z: flow[0].id,
            x: 400,
            y: 420,
            wires: [["pg154C2Store"]]
        });

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154C2App");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-pagination-page")).toContainText("2 / 6");

        // Click "next" → change event (params.page = 3) → function → store set → SSE.
        await page.locator(".webapp-pagination sl-button").nth(1).click();
        await expect(page.locator(".webapp-pagination-page")).toContainText("3 / 6", { timeout: 5000 });
    });

    test("C03 — external store change → SSE re-render sets the active page", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg154C3App", root: "pg154C3App" })
            .node("ui-store", {
                id: "pg154C3Store",
                statePath: "list",
                initialValue: JSON.stringify({ page: 1, total: 8 })
            })
            .node("ui-pagination", {
                id: "pg154C3",
                currentPage: { kind: "state", path: "list.page" },
                total: { kind: "state", path: "list.total" }
            })
            .withStoreInject("pg154C3Inj", "pg154C3Store", { page: 5, total: 8 })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154C3App");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-pagination-page")).toContainText("1 / 8");

        // External store replace → live re-render sets the active page to 5.
        await injectMessage(request, "pg154C3Inj");
        await expect(page.locator(".webapp-pagination-page")).toContainText("5 / 8", { timeout: 5000 });
    });

    // ─── events — output port ────────────────────────────────────────────────

    test("E01 — next click → POST /event { event:'change', params.page = n+1 }", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg154E1App", root: "pg154E1App" })
            .node("ui-pagination", {
                id: "pg154E1",
                currentPage: { kind: "literal", value: 2 },
                total: { kind: "literal", value: 5 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154E1App");
        await webapp.navigate("/");

        const eventPromise = webapp.interceptNextEvent();
        await page.locator(".webapp-pagination sl-button").nth(1).click();

        const body = await eventPromise;
        expect(body.event).toBe("change");
        expect((body.params as Record<string, unknown>).page).toBe(3);
    });

    // ─── showInfo info-text region (P252) ────────────────────────────────────

    test("I01 — showInfo:true renders the '.webapp-pagination-info' region", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg252I1App", root: "pg252I1App" })
            .node("ui-pagination", {
                id: "pg252I1",
                currentPage: { kind: "literal", value: 2 },
                total: { kind: "literal", value: 5 },
                showInfo: true
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg252I1App");
        await webapp.navigate("/");

        // The always-on compact page label is unchanged...
        await expect(page.locator(".webapp-pagination-page")).toContainText("2 / 5");
        // ...and showInfo:true adds the separate measured info-text region.
        await expect(page.locator(".webapp-pagination-info")).toBeVisible();
        await expect(page.locator(".webapp-pagination-info")).toContainText("Seite 2 von 5");
    });

    test("I02 — showInfo omitted → no '.webapp-pagination-info' region", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg252I2App", root: "pg252I2App" })
            .node("ui-pagination", {
                id: "pg252I2",
                currentPage: { kind: "literal", value: 2 },
                total: { kind: "literal", value: 5 }
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg252I2App");
        await webapp.navigate("/");

        await expect(page.locator(".webapp-pagination-page")).toContainText("2 / 5");
        // No showInfo → the info-text region is not emitted at all.
        await expect(page.locator(".webapp-pagination-info")).toHaveCount(0);
    });

    // ─── migration (legacy plain paths) ──────────────────────────────────────

    test("M01 — legacy currentPagePath migrated: active page read from the store", async ({ page, request }) => {
        // Simulate a pre-P154 flow: plain-string paths, no binding objects.
        const flow = new FlowBuilder()
            .app({ id: "pg154M1App", root: "pg154M1App" })
            .node("ui-store", {
                id: "pg154M1Store",
                statePath: "data",
                initialValue: JSON.stringify({ currentPage: 3, totalPages: 10 })
            })
            .node("ui-pagination", {
                id: "pg154M1",
                currentPagePath: "data.currentPage",
                totalPath: "data.totalPages"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154M1App");
        await webapp.navigate("/");
        // Both legacy paths migrate to state bindings → "3 / 10".
        await expect(page.locator(".webapp-pagination-page")).toContainText("3 / 10");
    });

    test("M02 — legacy totalPath migrated: total label resolved from the store", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pg154M2App", root: "pg154M2App" })
            .node("ui-store", {
                id: "pg154M2Store",
                statePath: "data",
                initialValue: JSON.stringify({ currentPage: 1, totalPages: 42 })
            })
            .node("ui-pagination", {
                id: "pg154M2",
                currentPagePath: "data.currentPage",
                totalPath: "data.totalPages"
            })
            .build();

        await deployFlow(request, flow);

        const webapp = new WebappPage(page, "pg154M2App");
        await webapp.navigate("/");
        await expect(page.locator(".webapp-pagination-page")).toContainText("1 / 42");
    });
});
