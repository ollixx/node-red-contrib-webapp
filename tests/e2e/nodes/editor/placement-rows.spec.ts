import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P49a — central editor-field injection regression guard.
 *
 * The grid placement rows (order/row/col/colSize/rowSize/layoutX/layoutY) used
 * to be copy-pasted into every view node's HTML template. P49a moved that markup
 * into ONE central injector in resources/lib/editor-common.js
 * (injectPlacementRows, via the generic injectFieldGroup primitive). This is a
 * pure refactor: the rendered editor panel and the saved node config must be
 * unchanged.
 *
 * These tests prove the refactor end to end in a real Node-RED editor:
 *   1. The injected rows appear when a panel opens (markup is no longer static).
 *   2. They still show/hide per the mount's layout (the existing
 *      installLayoutChildPropRows visibility contract, against injected rows).
 *   3. Two representative migrated nodes (ui-text, ui-table) get the rows.
 *   4. Opening + saving a node without edits leaves its config identical.
 */

const PLACEMENT_FIELDS = ["order", "row", "col", "colSize", "rowSize", "layoutX", "layoutY"];

test.describe("editor panels — central placement-row injection (P49a)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    for (const type of ["ui-text", "ui-table"]) {
        test(`${type} — placement rows are injected into the panel`, async ({ page, request }) => {
            const nodeId = `${type}-pl`;
            const flow = new FlowBuilder()
                .app({ id: "plApp", root: "plApp", name: "Placement App" })
                .node(type, { id: nodeId })
                .build();
            await deployFlow(request, flow);

            const editor = new NodeEditorPage(page);
            await editor.open();
            await editor.openNode(nodeId);

            // Every placement input exists in the DOM even though the static
            // template no longer carries the markup — it was injected.
            for (const field of PLACEMENT_FIELDS) {
                await expect(
                    page.locator(`#node-input-${field}`),
                    `expected injected placement input #node-input-${field}`
                ).toHaveCount(1);
            }

            // Exactly one injected field-group container (idempotent injection).
            await expect(page.locator('[data-field-group="layout-placement"]')).toHaveCount(1);

            // P139 (ADR 0015): the central injector prepends a "Layout" heading
            // over the placement rows — one heading, landing on every node at once.
            const heading = page.locator('[data-group-heading="layout-placement"]');
            await expect(heading).toHaveCount(1);
            await expect(heading).toHaveText("Layout");
        });
    }

    test("ui-text in a grid route — grid rows visible, layout rows hidden", async ({ page, request }) => {
        const nodeId = "ui-text-grid";
        // The editor resolves a mount's layout from the `route:<path>/<slot>`
        // form (getMountLayoutId in editor-common.js) — that is the form the
        // visibility toggle keys off, so the spec uses it.
        const flow = new FlowBuilder()
            .app({ id: "gridApp", root: "gridApp", name: "Grid App" })
            .route({ id: "gridRoute", path: "/grid", layout: "grid" })
            .node("ui-text", { id: nodeId, mount: "route:/grid/content" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);

        const visible = async (field: string) =>
            page.locator(`[data-layout-child-prop-row="${field}"]`).isVisible();

        // grid layout → row/col/colSize/rowSize shown; order/layoutX/layoutY hidden.
        expect(await visible("row")).toBe(true);
        expect(await visible("col")).toBe(true);
        expect(await visible("colSize")).toBe(true);
        expect(await visible("rowSize")).toBe(true);
        expect(await visible("order")).toBe(false);
        expect(await visible("layoutX")).toBe(false);
        expect(await visible("layoutY")).toBe(false);

        // P139: with placement fields active, the "Layout" heading is shown.
        await expect(page.locator('[data-group-heading="layout-placement"]')).toBeVisible();
    });

    test("ui-text in an app-layout slot — no placement fields, Layout heading hidden (P139)", async ({ page, request }) => {
        const nodeId = "ui-text-app";
        // The "app" layout has no child placement fields (layoutChildFieldsByVariant),
        // so every placement row stays hidden — and so must the central heading.
        const flow = new FlowBuilder()
            .app({ id: "appLayoutApp", root: "appLayoutApp", name: "App Layout App", layout: "app" })
            .node("ui-text", { id: nodeId, mount: "appLayoutApp.content" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);

        for (const field of PLACEMENT_FIELDS) {
            await expect(page.locator(`[data-layout-child-prop-row="${field}"]`)).toBeHidden();
        }
        await expect(page.locator('[data-group-heading="layout-placement"]')).toBeHidden();
    });

    test("ui-text in a vertical route — only order visible", async ({ page, request }) => {
        const nodeId = "ui-text-vert";
        const flow = new FlowBuilder()
            .app({ id: "vertApp", root: "vertApp", name: "Vert App" })
            .route({ id: "vertRoute", path: "/vert", layout: "vertical" })
            .node("ui-text", { id: nodeId, mount: "route:/vert/content" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);

        const visible = async (field: string) =>
            page.locator(`[data-layout-child-prop-row="${field}"]`).isVisible();

        expect(await visible("order")).toBe(true);
        expect(await visible("row")).toBe(false);
        expect(await visible("col")).toBe(false);

        // P139: the "Layout" heading is shown for the active vertical layout.
        await expect(page.locator('[data-group-heading="layout-placement"]')).toBeVisible();
    });

    test("ui-text in a grid route — placement values round-trip through save unchanged", async ({ page, request }) => {
        const nodeId = "ui-text-rt";
        const flow = new FlowBuilder()
            .app({ id: "rtApp", root: "rtApp", name: "RT App" })
            .route({ id: "rtRoute", path: "/rt", layout: "grid" })
            .node("ui-text", { id: nodeId, mount: "rtRoute.content", row: 2, col: 3, colSize: 4, rowSize: 1 })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode(nodeId);

        // The stored values are bound into the injected inputs.
        expect(await page.locator("#node-input-row").inputValue()).toBe("2");
        expect(await page.locator("#node-input-col").inputValue()).toBe("3");
        expect(await page.locator("#node-input-colSize").inputValue()).toBe("4");
        expect(await page.locator("#node-input-rowSize").inputValue()).toBe("1");

        // Save without editing — the node config must be identical.
        await editor.save();

        const after = await page.evaluate((id) => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node(id);
            return n
                ? { row: n.row, col: n.col, colSize: n.colSize, rowSize: n.rowSize, order: n.order, mount: n.mount }
                : null;
        }, nodeId);

        expect(after).toEqual({ row: 2, col: 3, colSize: 4, rowSize: 1, order: "", mount: "rtRoute.content" });
    });
});
