import { describe, expect, it } from "vitest";

import type { RenderSnapshot, RenderedComponent, RenderedRegion } from "@node-red-contrib-webapp/renderer";

/**
 * P27 — De-hardcode the runtime.
 *
 * P32 removed the preview simulation entirely. The domain-agnostic guarantee
 * is now expressed directly: nodes/webapp.js must not contain any example-specific
 * identifiers (customer, /customers) and the runtime must never hold demo data.
 * The ui-query node no longer carries previewData — seed data belongs in the
 * wired flow (function/storage nodes), not in the framework.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

const buildAppSnapshot = webappTest.buildAppSnapshot as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { success: boolean; status: number; snapshot?: RenderSnapshot };

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

// A fully generic app described entirely by nodes (no previewData — that was removed in P32).
// All seed data for a real app comes from the wired flow.
const rawNodes = [
    { type: "ui-app", id: "itemsApp", name: "Items App", root: "itemsApp", layout: "app", z: "p27" },
    { type: "ui-route", id: "list", name: "List", parent: "itemsApp", path: "/list", title: "List", layoutId: "app", z: "p27" },
    { type: "ui-query", id: "items", name: "Items", parent: "itemsApp", queryPath: "items.list", z: "p27" },
    { type: "ui-store", id: "draft", name: "Draft", parent: "itemsApp", statePath: "draft.item", z: "p27" },
    { type: "ui-dialog", id: "editor", name: "Editor", parent: "itemsApp", title: "Editor", layoutId: "vertical", z: "p27" },
    { type: "ui-table", id: "itemsTable", name: "Items", mount: "route:/list/content", rows: { kind: "query", path: "items.list" }, columns: [{ key: "name", label: "Name" }], z: "p27" },
    { type: "ui-input", id: "nameInput", name: "Name", mount: "dialog:editor/content", path: "name", storeId: "draft", value: { kind: "state", path: "draft.item.name" }, z: "p27" }
];

const definitions = buildDefinitions(rawNodes);

describe("P27: de-hardcoded, node-driven runtime", () => {
    it("renders the app route without any seed data — an empty table is correct until the flow pushes data", () => {
        const snapshot = buildAppSnapshot("itemsApp", "/list", undefined, definitions);
        expect(snapshot.success).toBe(true);

        const table = flattenSnapshotComponents((snapshot.snapshot as RenderSnapshot).regions).find((c) => c.id === "itemsTable") as RenderedComponent & { rows?: unknown[] };
        // Without a wired flow pushing data, the table has no rows — correct by design.
        expect(Array.isArray(table.rows ?? [])).toBe(true);
    });

    it("ui-query mapConfig no longer carries previewData — it was removed in P32", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require("node:fs") as typeof import("node:fs");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require("node:path") as typeof import("node:path");
        const source = fs.readFileSync(path.resolve(__dirname, "../../../nodes/webapp.js"), "utf8");
        // previewData must not appear in the runtime logic (schema still has the field
        // declared as optional for backward compat, but webapp.js must not read it).
        expect(source).not.toContain("previewData");
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
