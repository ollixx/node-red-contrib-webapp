import { describe, expect, it } from "vitest";

import type { RenderSnapshot, RenderedComponent, RenderedRegion } from "@node-red-contrib-webapp/renderer";

/**
 * P27 — De-hardcode the runtime.
 *
 * The runtime entry point (nodes/webapp.js) must be example-agnostic: dialog
 * open/close, data persistence (save/delete), query refresh and navigation all
 * flow through the generic typed-action / store / query mechanism and demo data
 * comes from node config (ui-query previewData), not from a hard-coded backend.
 *
 * These tests drive the webapp.js helpers directly, using a generic "items"
 * domain (no customer-specific identifiers) to prove the behaviour is generic.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

const applyPreviewAction = webappTest.applyPreviewAction as (
    RED: unknown,
    appId: string,
    actionId: string,
    parameters: Record<string, unknown>,
    definitions: unknown[]
) => { success: boolean; status?: number; redirectLocation?: string; dialogId?: string; message?: unknown };

const buildAppSnapshot = webappTest.buildAppSnapshot as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { success: boolean; status: number; snapshot?: RenderSnapshot };

const resetPreview = webappTest.resetPreview as (appId: string) => void;

const stubRED = { nodes: { getNode: () => undefined } };

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

function flattenSnapshotComponents(regions: RenderedRegion[]): RenderedComponent[] {
    return regions.flatMap((region) =>
        region.components.flatMap((component) =>
            component.kind === "container" ? [component, ...flattenSnapshotComponents(component.regions)] : [component]
        )
    );
}

// A fully generic CRUD app described entirely by nodes. The seed data lives on
// the ui-query node (previewData), and the actions declare their generic
// behaviour: show/hide a dialog, submit a record into a collection, remove one.
const rawNodes = [
    { type: "ui-app", id: "itemsApp", name: "Items App", root: "itemsApp", layout: "app", z: "p27" },
    { type: "ui-route", id: "list", name: "List", parent: "itemsApp", path: "/list", title: "List", layoutId: "app", z: "p27" },
    {
        type: "ui-query", id: "items", name: "Items", parent: "itemsApp", queryPath: "items.list",
        previewData: { list: [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }] }, z: "p27"
    },
    { type: "ui-store", id: "draft", name: "Draft", parent: "itemsApp", statePath: "draft.item", z: "p27" },
    { type: "ui-dialog", id: "editor", name: "Editor", parent: "itemsApp", title: "Editor", layoutId: "vertical", z: "p27" },
    { type: "ui-table", id: "itemsTable", name: "Items", mount: "route:/list/content", rows: { kind: "query", path: "items.list" }, columns: [{ key: "name", label: "Name" }], z: "p27" },
    { type: "ui-input", id: "nameInput", name: "Name", mount: "dialog:editor/content", path: "name", storeId: "draft", value: { kind: "state", path: "draft.item.name" }, z: "p27" },
    // Generic typed actions — no hard-coded handler in the runtime.
    { type: "ui-action", id: "openEditor", name: "Open", parent: "itemsApp", actionType: "show", targetMode: "path", target: "dialog:editor", z: "p27" },
    { type: "ui-action", id: "closeEditor", name: "Close", parent: "itemsApp", actionType: "hide", targetMode: "path", target: "dialog:editor", z: "p27" },
    { type: "ui-action", id: "saveItem", name: "Save", parent: "itemsApp", actionType: "submit", collection: "items.list", draftPath: "draft.item", dialog: "editor", z: "p27" },
    { type: "ui-action", id: "deleteItem", name: "Delete", parent: "itemsApp", actionType: "remove", collection: "items.list", z: "p27" }
];

const definitions = buildDefinitions(rawNodes).map((definition) =>
    (definition as { type?: string; actionType?: string }).type === "ui-action"
    && ((definition as { actionType?: string }).actionType === "show" || (definition as { actionType?: string }).actionType === "hide")
        // targetMode/target are dropped by mapConfig but the preview's typed
        // show/hide branch still honours them — re-attach for the dispatch.
        ? { ...definition, targetMode: "path", target: "dialog:editor" }
        : definition
);

describe("P27: de-hardcoded, node-driven runtime", () => {
    it("seeds demo query data from ui-query previewData (not from the runtime)", () => {
        resetPreview("itemsApp");
        const snapshot = buildAppSnapshot("itemsApp", "/list", undefined, definitions);
        expect(snapshot.success).toBe(true);

        const table = flattenSnapshotComponents((snapshot.snapshot as RenderSnapshot).regions).find((c) => c.id === "itemsTable") as RenderedComponent & { rows?: unknown[] };
        expect((table.rows ?? []).map((r) => (r as { name: string }).name)).toEqual(["Alpha", "Beta"]);
        resetPreview("itemsApp");
    });

    it("a different app renders its own previewData — proving it is config-driven", () => {
        const otherRaw = rawNodes.map((node) =>
            node.type === "ui-query"
                ? { ...node, previewData: { list: [{ id: "z", name: "Zeta" }] } }
                : node.type === "ui-app"
                    ? node
                    : node
        );
        const otherDefs = buildDefinitions(otherRaw);
        resetPreview("itemsApp");
        const snapshot = buildAppSnapshot("itemsApp", "/list", undefined, otherDefs);
        const table = flattenSnapshotComponents((snapshot.snapshot as RenderSnapshot).regions).find((c) => c.id === "itemsTable") as RenderedComponent & { rows?: unknown[] };
        expect((table.rows ?? []).map((r) => (r as { name: string }).name)).toEqual(["Zeta"]);
        resetPreview("itemsApp");
    });

    it("opens and closes a dialog purely through typed show/hide actions", () => {
        resetPreview("itemsApp");

        const opened = applyPreviewAction(stubRED, "itemsApp", "openEditor", { location: "/list", sourceId: "openEditor", event: "click" }, definitions);
        expect(opened.success).toBe(true);
        const afterOpen = buildAppSnapshot("itemsApp", "/list", opened.dialogId, definitions);
        expect((afterOpen.snapshot as RenderSnapshot).dialogs.map((d) => d.id)).toContain("editor");

        const closed = applyPreviewAction(stubRED, "itemsApp", "closeEditor", { location: "/list", sourceId: "closeEditor", event: "click" }, definitions);
        expect(closed.success).toBe(true);
        const afterClose = buildAppSnapshot("itemsApp", "/list", closed.dialogId, definitions);
        expect((afterClose.snapshot as RenderSnapshot).dialogs).toHaveLength(0);
        resetPreview("itemsApp");
    });

    it("saves a new record into the collection via a generic submit action and closes its dialog", () => {
        resetPreview("itemsApp");
        // open editor first
        applyPreviewAction(stubRED, "itemsApp", "openEditor", { location: "/list", sourceId: "openEditor", event: "click" }, definitions);

        const saved = applyPreviewAction(stubRED, "itemsApp", "saveItem", { location: "/list", sourceId: "saveItem", event: "submit", name: "Gamma" }, definitions);
        expect(saved.success).toBe(true);

        const snapshot = buildAppSnapshot("itemsApp", "/list", saved.dialogId, definitions);
        const table = flattenSnapshotComponents((snapshot.snapshot as RenderSnapshot).regions).find((c) => c.id === "itemsTable") as RenderedComponent & { rows?: unknown[] };
        expect((table.rows ?? []).map((r) => (r as { name: string }).name)).toContain("Gamma");
        // the editor dialog closed after save
        expect((snapshot.snapshot as RenderSnapshot).dialogs).toHaveLength(0);
        resetPreview("itemsApp");
    });

    it("updates an existing record when the draft carries its key", () => {
        resetPreview("itemsApp");
        const saved = applyPreviewAction(stubRED, "itemsApp", "saveItem", { location: "/list", sourceId: "saveItem", event: "submit", id: "a", name: "Alpha-2" }, definitions);
        expect(saved.success).toBe(true);
        const snapshot = buildAppSnapshot("itemsApp", "/list", undefined, definitions);
        const table = flattenSnapshotComponents((snapshot.snapshot as RenderSnapshot).regions).find((c) => c.id === "itemsTable") as RenderedComponent & { rows?: unknown[] };
        const names = (table.rows ?? []).map((r) => (r as { id: string; name: string }));
        expect(names.find((r) => r.id === "a")?.name).toBe("Alpha-2");
        expect(names.filter((r) => r.id === "a")).toHaveLength(1);
        resetPreview("itemsApp");
    });

    it("removes a record from the collection via a generic remove action", () => {
        resetPreview("itemsApp");
        const removed = applyPreviewAction(stubRED, "itemsApp", "deleteItem", { location: "/list", sourceId: "deleteItem", event: "click", id: "a" }, definitions);
        expect(removed.success).toBe(true);
        const snapshot = buildAppSnapshot("itemsApp", "/list", undefined, definitions);
        const table = flattenSnapshotComponents((snapshot.snapshot as RenderSnapshot).regions).find((c) => c.id === "itemsTable") as RenderedComponent & { rows?: unknown[] };
        expect((table.rows ?? []).map((r) => (r as { id: string }).id)).toEqual(["b"]);
        resetPreview("itemsApp");
    });
});

describe("P27: runtime entry point is example-agnostic", () => {
    it("nodes/webapp.js contains no customer identifiers and no /customers literal", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require("node:fs") as typeof import("node:fs");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require("node:path") as typeof import("node:path");
        const source = fs.readFileSync(path.resolve(__dirname, "../../../nodes/webapp.js"), "utf8");
        expect(/customer/i.test(source)).toBe(false);
        expect(source.includes("/customers")).toBe(false);
    });
});
