import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";

/**
 * P68 — unified node-picker dialog.
 *
 * Every ui-* node selection (parents, routes, actions, stores, references) is
 * enhanced with ONE reusable picker dialog (resources/lib/editor-common.js):
 * a "list" button next to the existing <select> opens a modal with a scrollable
 * candidate list and a case-insensitive contains-search over name, id AND type.
 * Only the DEFAULT filter (preset) differs per field. Selecting in the dialog
 * writes the chosen id back into the bound <select> — values stay IDs, the save
 * round-trip is unchanged.
 *
 * These tests drive the real Node-RED editor:
 *   1. The picker button is injected next to enhanced selects.
 *   2. Opening it shows the preset-filtered candidates only (store preset → only
 *      ui-store nodes; the ui-action sibling is NOT listed).
 *   3. The contains-search narrows by name, id and type.
 *   4. Picking a row writes the id into the <select> and round-trips through save.
 *
 * Pure helpers (nodePickerMatch / nodePickerPresets) are also asserted directly
 * in the page context — they are the testable core the dialog renders from.
 */

test.describe("editor — unified node-picker dialog (P68)", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("nodePickerMatch matches over name, id and type (case-insensitive)", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        const result = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, (...a: unknown[]) => unknown> }).WebappEditorCommon;
            const match = C.nodePickerMatch as (e: unknown, q: string) => boolean;
            const entry = { value: "s1", label: "Customers Store", name: "Customers Store", id: "store-abc", type: "ui-store" };
            return {
                emptyQuery: match(entry, ""),
                byName: match(entry, "customers"),
                byNameCase: match(entry, "CUSTOMERS"),
                byId: match(entry, "abc"),
                byType: match(entry, "ui-store"),
                miss: match(entry, "zzz")
            };
        });

        expect(result).toEqual({
            emptyQuery: true,
            byName: true,
            byNameCase: true,
            byId: true,
            byType: true,
            miss: false
        });
    });

    test("store preset lists only ui-store nodes; picking one round-trips", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "pickApp", root: "pickApp", name: "Picker App" })
            .node("ui-store", { id: "storeA", name: "Alpha Store", statePath: "alpha" })
            .node("ui-store", { id: "storeB", name: "Beta Store", statePath: "beta" })
            .node("ui-action", { id: "actX", name: "Some Action" })
            .node("ui-query", { id: "queryNode", name: "Query Node" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("queryNode");

        // The picker button is injected next to the store <select>.
        const storeButton = page.locator("#node-input-params + .webapp-node-picker-button");
        await expect(storeButton).toHaveCount(1);

        // The candidate entries the dialog renders from, for the store preset.
        const entries = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, (...a: unknown[]) => unknown> }).WebappEditorCommon;
            const opts = (C.nodePickerOptionsForPreset as (p: string) => Array<{ value: string; type: string }>)("stores");
            return opts.map((o) => ({ value: o.value, type: o.type }));
        });
        const ids = entries.map((e) => e.value);
        expect(ids).toContain("storeA");
        expect(ids).toContain("storeB");
        // The ui-action sibling is NOT a store candidate.
        expect(ids).not.toContain("actX");
        expect(entries.every((e) => e.type === "ui-store")).toBe(true);

        // Open the dialog, search by name, pick the match.
        await storeButton.click();
        await expect(page.locator(".webapp-node-picker-dialog")).toBeVisible();
        await page.locator(".webapp-node-picker-search").fill("Beta");
        const rows = page.locator(".webapp-node-picker-row");
        await expect(rows).toHaveCount(1);
        await rows.first().click();

        // Dialog closed and the bound select now carries the picked id.
        await expect(page.locator(".webapp-node-picker-dialog")).toHaveCount(0);
        expect(await page.locator("#node-input-params").inputValue()).toBe("storeB");

        // Save without further edits — the id round-trips onto the node config.
        await editor.save();
        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("queryNode");
            return n ? n.params : null;
        });
        expect(saved).toBe("storeB");
    });

    test("contains-search narrows by id and by type", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "searchApp", root: "searchApp", name: "Search App" })
            .node("ui-store", { id: "needle-store", name: "Findme", statePath: "x" })
            .node("ui-store", { id: "other-store", name: "Hidden", statePath: "y" })
            .node("ui-query", { id: "q2", name: "Q2" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("q2");

        await page.locator("#node-input-params + .webapp-node-picker-button").click();
        await expect(page.locator(".webapp-node-picker-dialog")).toBeVisible();

        const search = page.locator(".webapp-node-picker-search");
        const rows = page.locator(".webapp-node-picker-row");

        // by id substring
        await search.fill("needle");
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText("needle-store");

        // by type — both stores match
        await search.fill("ui-store");
        await expect(rows).toHaveCount(2);

        // no match
        await search.fill("does-not-exist");
        await expect(rows).toHaveCount(0);
    });
});
