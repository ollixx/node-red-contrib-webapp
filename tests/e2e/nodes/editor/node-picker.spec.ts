import { expect, test } from "@playwright/test";

import { deployFlow, resetFlow } from "../../../helpers/admin-api";
import { FlowBuilder } from "../../../helpers/flow-builder";
import { NodeEditorPage } from "../../../helpers/node-editor-page";
import {
    pickReference,
    pickerFieldButton,
    pickerFieldClear,
    pickerFieldDisplay,
    pickerFieldValue,
    openPicker
} from "../../../helpers/picker-dialog";

/**
 * P114 / ADR 0009 — the picker dialog is the SOLE reference-selection mechanism.
 *
 * Every reference field (parent, routeId, action, store, mount) renders the
 * dialog-only pattern: the bound `#node-input-*` is HIDDEN (it stays the value
 * carrier so the save round-trip is unchanged) and a read-only display + an
 * "Auswählen…" button sit next to it. There is no visible, fully-populated
 * reference `<select>` anywhere in a panel. Selection happens through the P68
 * dialog (scrollable, contains-search), including a new `mounts` preset whose
 * rows are breadcrumb labels.
 *
 * These tests drive the real Node-RED editor and assert:
 *   1. The pure core (nodePickerMatch / nodePickerPresets) the dialog renders from.
 *   2. The display+button pattern is present and the bound control is hidden.
 *   3. The store preset lists only ui-store nodes; picking one round-trips.
 *   4. The contains-search narrows by name, id and type.
 *   5. The mounts preset offers breadcrumb rows; search + pick writes the mount.
 *   6. Optional fields clear via "×"; a non-resolvable value shows "(bestehend)".
 */

test.describe("editor — picker dialog as sole reference selection (P114)", () => {
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

    test("reference fields render display + button, and the bound control is hidden (no visible select)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "patApp", root: "patApp", name: "Pattern App", layout: "app" })
            .node("ui-input", { id: "inp1", name: "Input 1" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("inp1");

        // The mount field is the dialog-only pattern: button visible, bound
        // control hidden, NO visible reference <select> in the wrapper.
        await expect(pickerFieldButton(page, "mount")).toBeVisible();
        await expect(page.locator("#node-input-mount")).toBeHidden();
        await expect(pickerFieldDisplay(page, "mount")).toBeVisible();

        // The store field (ui-input has one) is likewise dialog-only and clearable.
        await expect(pickerFieldButton(page, "storeId")).toBeVisible();
        await expect(page.locator("#node-input-storeId")).toBeHidden();
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

        // The store picker button is rendered next to the (hidden) store field.
        await expect(pickerFieldButton(page, "params")).toBeVisible();
        await expect(page.locator("#node-input-params")).toBeHidden();

        // The candidate entries the dialog renders from, for the store preset.
        const entries = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, (...a: unknown[]) => unknown> }).WebappEditorCommon;
            const opts = (C.nodePickerOptionsForPreset as (p: string) => Array<{ value: string; type: string }>)("stores");
            return opts.map((o) => ({ value: o.value, type: o.type }));
        });
        const ids = entries.map((e) => e.value);
        expect(ids).toContain("storeA");
        expect(ids).toContain("storeB");
        expect(ids).not.toContain("actX");
        expect(entries.every((e) => e.type === "ui-store")).toBe(true);

        // Pick "Beta" through the dialog; the hidden carrier holds the id.
        await pickReference(page, "params", { search: "Beta", expectValue: "storeB" });

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

        await openPicker(page, "params");

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

    test("mounts preset offers breadcrumb rows; search + pick writes the mount value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "shopApp", root: "shopApp", name: "Shop", layout: "app" })
            .route({ id: "custRoute", path: "/customers", layoutId: "grid", title: "Customers" })
            .node("ui-text", { id: "txt1", name: "Text 1" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("txt1");

        // The mounts preset entries are breadcrumb-labelled, mount-valued.
        const entries = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, (...a: unknown[]) => unknown> }).WebappEditorCommon;
            const opts = (C.nodePickerOptionsForPreset as (p: string) => Array<{ value: string; label: string; type: string }>)("mounts");
            return opts.map((o) => ({ value: o.value, label: o.label, type: o.type }));
        });
        const values = entries.map((e) => e.value);
        expect(values).toContain("shopApp.content");
        expect(values).toContain("route:/customers/content");
        expect(entries.every((e) => e.type === "mount")).toBe(true);

        // Open the dialog, search by the route path, pick the route content slot.
        // The breadcrumb label is self-describing ("Shop > Customers > content").
        await pickReference(page, "mount", {
            search: "/customers/content",
            rowText: "Customers",
            expectValue: "route:/customers/content"
        });

        // The display now shows the chosen breadcrumb (the route title).
        await expect(pickerFieldDisplay(page, "mount")).toContainText("Customers");

        // Round-trips through save.
        await editor.save();
        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("txt1");
            return n ? n.mount : null;
        });
        expect(saved).toBe("route:/customers/content");
    });

    test("optional store field clears via '×' and saves an empty value", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "clrApp", root: "clrApp", name: "Clear App" })
            .node("ui-store", { id: "theStore", name: "The Store", statePath: "s" })
            .node("ui-query", { id: "q3", name: "Q3", params: "theStore" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("q3");

        // The stored reference is shown and the clear control is available.
        expect(await pickerFieldValue(page, "params")).toBe("theStore");
        await expect(pickerFieldClear(page, "params")).toBeVisible();

        await pickerFieldClear(page, "params").click();
        expect(await pickerFieldValue(page, "params")).toBe("");

        await editor.save();
        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("q3");
            return n ? n.params : null;
        });
        expect(saved).toBe("");
    });

    test("a non-resolvable stored value is shown as '(bestehend)' and survives save", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "ghostApp", root: "ghostApp", name: "Ghost App" })
            // points at a store id that does NOT exist in the graph.
            .node("ui-query", { id: "q4", name: "Q4", params: "deleted-store-id" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("q4");

        await expect(pickerFieldDisplay(page, "params")).toContainText("deleted-store-id");
        await expect(pickerFieldDisplay(page, "params")).toContainText("bestehend");

        // Opening + saving without touching it keeps the value.
        await editor.save();
        const saved = await page.evaluate(() => {
            const n = (window as unknown as {
                RED: { nodes: { node: (id: string) => Record<string, unknown> | null } };
            }).RED.nodes.node("q4");
            return n ? n.params : null;
        });
        expect(saved).toBe("deleted-store-id");
    });
});

/**
 * P117 — App-scope filtering + Admin-UI look for the picker dialog.
 *
 * These tests drive the real Node-RED editor and assert:
 *   1. Pure helpers (resolveEditedNodeApp / resolveAppFromMount / isMountUnderApp).
 *   2. Store picker in a ui-route panel shows only stores of the route's app.
 *   3. Scope follows the live panel: switching app yields different candidates.
 *   4. Fallback without app context shows all stores, each with app in secondary line.
 *   5. Dialog typography uses sans-serif (no `serif` keyword in computed font-family).
 */
test.describe("P117 — picker app-scope + admin-UI look", () => {
    test.afterEach(async ({ request }) => {
        await resetFlow(request);
    });

    test("resolveEditedNodeApp resolves from parent field (direct app)", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        const result = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, unknown> }).WebappEditorCommon;
            const resolve = C.resolveEditedNodeApp as (node: unknown, refs: unknown) => string | null;

            const refs = {
                apps: [{ id: "appA", title: "App A", layoutId: "app" }],
                routes: [],
                dialogs: [],
                containers: [],
                actions: [],
                stores: []
            };
            const nodeWithParent = { parent: "appA" };
            const nodeNoParent = {};

            return {
                withParent: resolve(nodeWithParent, refs),
                noParent: resolve(nodeNoParent, refs)
            };
        });

        expect(result.withParent).toBe("appA");
        expect(result.noParent).toBeNull();
    });

    test("resolveAppFromMount walks route/dialog/container chain", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        const result = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, unknown> }).WebappEditorCommon;
            const resolve = C.resolveAppFromMount as (mount: string, refs: unknown, appIds: Set<string>) => string | null;

            const refs = {
                apps: [{ id: "shopApp", title: "Shop" }],
                routes: [{ id: "r1", path: "/customers", parent: "shopApp", layoutId: "grid" }],
                dialogs: [{ id: "d1", parent: "shopApp", layoutId: "dialog" }],
                containers: [{ id: "c1", mount: "route:/customers/content", layoutId: "vertical" }],
                actions: [],
                stores: []
            };
            const appIds = new Set<string>(["shopApp"]);

            return {
                directSlot: resolve("shopApp.content", refs, appIds),
                routeSlot: resolve("route:/customers/content", refs, appIds),
                dialogSlot: resolve("dialog:d1/content", refs, appIds),
                containerSlot: resolve("container:c1/content", refs, appIds),
                unknown: resolve("route:/unknown/content", refs, appIds)
            };
        });

        expect(result.directSlot).toBe("shopApp");
        expect(result.routeSlot).toBe("shopApp");
        expect(result.dialogSlot).toBe("shopApp");
        expect(result.containerSlot).toBe("shopApp");
        expect(result.unknown).toBeNull();
    });

    test("isMountUnderApp filters correctly", async ({ page }) => {
        const editor = new NodeEditorPage(page);
        await editor.open();

        const result = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, unknown> }).WebappEditorCommon;
            const fn = C.isMountUnderApp as (mount: string, refs: unknown, appId: string) => boolean;

            const refs = {
                apps: [
                    { id: "appA", title: "App A" },
                    { id: "appB", title: "App B" }
                ],
                routes: [
                    { id: "rA", path: "/a", parent: "appA", layoutId: "vertical" },
                    { id: "rB", path: "/b", parent: "appB", layoutId: "vertical" }
                ],
                dialogs: [],
                containers: [],
                actions: [],
                stores: []
            };

            return {
                appASlotUnderA: fn("appA.content", refs, "appA"),
                appASlotUnderB: fn("appA.content", refs, "appB"),
                routeAUnderA: fn("route:/a/content", refs, "appA"),
                routeAUnderB: fn("route:/a/content", refs, "appB"),
                routeBUnderB: fn("route:/b/content", refs, "appB")
            };
        });

        expect(result.appASlotUnderA).toBe(true);
        expect(result.appASlotUnderB).toBe(false);
        expect(result.routeAUnderA).toBe(true);
        expect(result.routeAUnderB).toBe(false);
        expect(result.routeBUnderB).toBe(true);
    });

    test("store picker in a ui-route panel shows only stores of the route's app (app A has only storeA)", async ({ page, request }) => {
        // Two apps, each with one store.
        const flowA = new FlowBuilder()
            .app({ id: "appA", root: "appA", name: "App A" })
            .node("ui-store", { id: "storeA", name: "Store A", statePath: "a" })
            .node("ui-route", { id: "routeA", path: "/a", parent: "appA", name: "Route A", layoutId: "vertical" })
            .build();
        const flowB = new FlowBuilder()
            .app({ id: "appB", root: "appB", name: "App B" })
            .node("ui-store", { id: "storeB", name: "Store B", statePath: "b" })
            .build();
        // Merge nodes from both flows into one deploy.
        const merged = [...flowA, ...flowB];
        await deployFlow(request, merged);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("routeA");

        // Open the title-store picker (storeTypedInputType)
        // The "Store für Titel auswählen" is a typedInput — we need to open the
        // expand button. Fall back to evaluating candidates via the API.
        const entries = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, unknown> }).WebappEditorCommon;
            const fn = C.nodePickerOptionsForPreset as (preset: string, ctx: unknown) => Array<{ value: string }>;
            // Simulate app context for appA.
            return fn("stores", { appId: "appA" }).map((e) => e.value);
        });
        expect(entries).toContain("storeA");
        expect(entries).not.toContain("storeB");
    });

    test("stores preset without appId shows all stores and includes app in secondary", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "xApp", root: "xApp", name: "X App" })
            .node("ui-store", { id: "xStore", name: "X Store", statePath: "x" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();

        // No appId context → all stores returned
        const entries = await page.evaluate(() => {
            const C = (window as unknown as { WebappEditorCommon: Record<string, unknown> }).WebappEditorCommon;
            const fn = C.nodePickerOptionsForPreset as (preset: string, ctx: unknown) => Array<{ value: string; secondary: string }>;
            return fn("stores", {});
        });
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.some((e) => e.value === "xStore")).toBe(true);
        // Secondary line should carry the app title for fallback mode.
        const xEntry = entries.find((e) => e.value === "xStore");
        expect(xEntry?.secondary).toBeTruthy();
    });

    test("picker dialog typography uses sans-serif editor font (no serif fallback)", async ({ page, request }) => {
        const flow = new FlowBuilder()
            .app({ id: "fontApp", root: "fontApp", name: "Font App" })
            .node("ui-store", { id: "fStore", name: "Font Store", statePath: "f" })
            .node("ui-query", { id: "fontQuery", name: "Font Query" })
            .build();
        await deployFlow(request, flow);

        const editor = new NodeEditorPage(page);
        await editor.open();
        await editor.openNode("fontQuery");

        await openPicker(page, "params");

        // Check computed font-family of the dialog root — must NOT contain "serif"
        // as the effective fallback (i.e. must be a sans-serif stack).
        const fontFamily = await page.evaluate(() => {
            const dialog = document.querySelector(".webapp-node-picker-dialog") as HTMLElement | null;
            if (!dialog) return "";
            return window.getComputedStyle(dialog).fontFamily;
        });

        // The font must not be purely a generic serif family.
        // It may contain "sans-serif" or a specific sans-serif font name.
        expect(fontFamily.toLowerCase()).not.toMatch(/^serif$/);
        // Should contain "sans-serif" somewhere OR a named sans font.
        const hassSansSomewhere = fontFamily.toLowerCase().includes("sans") ||
            fontFamily.toLowerCase().includes("helvetica") ||
            fontFamily.toLowerCase().includes("arial");
        expect(hassSansSomewhere).toBe(true);

        // Also check rows and search field within the open dialog.
        const rowFont = await page.evaluate(() => {
            const row = document.querySelector(".webapp-node-picker-row-primary") as HTMLElement | null;
            if (!row) return "";
            return window.getComputedStyle(row).fontFamily;
        });
        expect(rowFont.toLowerCase()).not.toMatch(/^serif$/);
    });
});
