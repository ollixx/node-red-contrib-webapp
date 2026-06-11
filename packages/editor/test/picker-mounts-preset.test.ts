import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P114 / ADR 0009 — unit coverage for the pure, browser-free core of the
 * picker-dialog rewrite: the `mounts` preset (flatten + breadcrumb labels) and
 * the match logic that searches breadcrumb AND mount value.
 *
 * `resources/lib/editor-common.js` is a browser IIFE that attaches
 * `WebappEditorCommon` to its global. The functions exercised here
 * (buildMountOptionsTree, flattenMountOptionTree, nodePickerPresets.mounts,
 * nodePickerMatch) touch neither jQuery nor RED — only the global to export —
 * so we load the file in a vm with a minimal stub global and assert on the
 * exported helpers directly. No DOM, no Playwright.
 */

type Entry = { value: string; label: string; name: string; id: string; type: string };
type References = Parameters<(r: unknown) => unknown> extends [infer R] ? R : never;

interface MountTreeSlot {
    value: string;
    slot: string;
}
interface MountTreeNode {
    key: string;
    kind: "app" | "route" | "dialog" | "container";
    label: string;
    slots: MountTreeSlot[];
    children: MountTreeNode[];
}

interface EditorCommon {
    buildMountOptionsTree: (references: unknown) => Array<{ label: string; options: Array<{ value?: string; label: string; disabled?: boolean }> }>;
    flattenMountOptionTree: (groups: unknown) => Entry[];
    buildMountPickerTree: (references: unknown, excludeContainerId?: string) => MountTreeNode[];
    findMountInTree: (tree: MountTreeNode[], mountValue: string) => { path: MountTreeNode[]; slot: string; node: MountTreeNode } | null;
    nodePickerPresets: { mounts: (references: unknown) => Entry[] };
    nodePickerMatch: (entry: Partial<Entry>, query: string) => boolean;
}

let common: EditorCommon;

beforeAll(() => {
    const editorCommonPath = fileURLToPath(
        new URL("../../../resources/lib/editor-common.js", import.meta.url)
    );
    const source = readFileSync(editorCommonPath, "utf8");
    // The file is `(function (global) { ... })(window)`. Provide `window` as the
    // sandbox global; the pure helpers under test never touch `$`/`RED`.
    const sandbox: Record<string, unknown> = {};
    sandbox.window = sandbox;
    createContext(sandbox);
    runInContext(source, sandbox);
    common = (sandbox.WebappEditorCommon as EditorCommon);
});

// A small reference graph: an app-shell app (header/navbar/content/footer slots),
// a grid route, and a container nested under the route's content slot.
function buildReferences(): References {
    return {
        apps: [{ id: "shopApp", layoutId: "app", title: "Shop" }],
        routes: [{ id: "custRoute", path: "/customers", layoutId: "grid", title: "Customers", parent: "shopApp" }],
        dialogs: [],
        containers: [{ id: "cardC", layoutId: "vertical", title: "Card", mount: "route:/customers/content" }],
        actions: [],
        stores: []
    } as unknown as References;
}

describe("P114: mounts picker preset", () => {
    it("flattens the option tree into entries with breadcrumb labels + mount values", () => {
        const entries = common.nodePickerPresets.mounts(buildReferences());

        // Every entry carries the mount string in BOTH value and id, the
        // breadcrumb in BOTH label and name, and the constant `mount` type.
        for (const entry of entries) {
            expect(entry.value).toBe(entry.id);
            expect(entry.label).toBe(entry.name);
            expect(entry.type).toBe("mount");
            expect(entry.value.length).toBeGreaterThan(0);
        }

        const byValue = new Map(entries.map((e) => [e.value, e.label]));

        // App-shell slots are present as mount values.
        expect(byValue.has("shopApp.content")).toBe(true);
        expect(byValue.has("shopApp.header")).toBe(true);

        // The grid route's content slot is present and its breadcrumb is readable.
        expect(byValue.has("route:/customers/content")).toBe(true);

        // The nested container contributes its own slot, with a breadcrumb that
        // chains through the parent route slot.
        expect(byValue.has("container:cardC/content")).toBe(true);
        expect(byValue.get("container:cardC/content")).toContain(">");
    });

    it("drops disabled group-header rows and de-duplicates mount values", () => {
        const groups = [
            {
                label: "Shop",
                options: [
                    { disabled: true, label: "Slots" },
                    { value: "shopApp.content", label: "content" },
                    { value: "shopApp.content", label: "content (dup)" },
                    { value: "shopApp.header", label: "header" }
                ]
            }
        ];

        const entries = common.flattenMountOptionTree(groups);
        expect(entries.map((e) => e.value)).toEqual(["shopApp.content", "shopApp.header"]);
        // No header row leaked through.
        expect(entries.some((e) => e.label === "Slots")).toBe(false);
    });

    it("matches a mount entry by breadcrumb AND by mount value (case-insensitive)", () => {
        const entry = {
            value: "route:/customers/content",
            label: "Shop > /customers > content",
            name: "Shop > /customers > content",
            id: "route:/customers/content",
            type: "mount"
        };

        // breadcrumb substring
        expect(common.nodePickerMatch(entry, "customers")).toBe(true);
        expect(common.nodePickerMatch(entry, "CUSTOMERS")).toBe(true);
        // mount-value substring (the `route:` prefix lives only in the value/id)
        expect(common.nodePickerMatch(entry, "route:")).toBe(true);
        // empty query matches
        expect(common.nodePickerMatch(entry, "")).toBe(true);
        // miss
        expect(common.nodePickerMatch(entry, "zzz")).toBe(false);
    });
});

// P135 / ADR 0014 — the structural node tree the two-column mount picker renders.
// The left column is the structure tree (App → Routes/Dialogs → Container →
// recursive child containers); the right column is the SLOTS of the selected
// node (the only selectable leaves; their mount strings are unchanged).
function multiAppReferences(): References {
    return {
        apps: [
            { id: "shopApp", layoutId: "app", title: "Shop" },
            { id: "adminApp", layoutId: "app", title: "Admin" }
        ],
        routes: [
            { id: "custRoute", path: "/customers", layoutId: "grid", title: "Customers", parent: "shopApp" },
            { id: "usersRoute", path: "/users", layoutId: "grid", title: "Users", parent: "adminApp" }
        ],
        dialogs: [{ id: "confirmDlg", layoutId: "vertical", title: "Confirm", parent: "shopApp" }],
        containers: [
            { id: "cardC", layoutId: "vertical", title: "Card", mount: "route:/customers/content" },
            { id: "innerC", layoutId: "vertical", title: "Inner", mount: "container:cardC/content" }
        ],
        actions: [],
        stores: []
    } as unknown as References;
}

describe("P135: buildMountPickerTree (two-column structure tree)", () => {
    it("nests App → Route → recursive child containers; only structural nodes are branches", () => {
        const tree = common.buildMountPickerTree(multiAppReferences());

        // Both apps are top-level branches (NOT app-scoped — P117 carried forward).
        const keys = tree.map((n) => n.key);
        expect(keys).toContain("app:shopApp");
        expect(keys).toContain("app:adminApp");

        const shop = tree.find((n) => n.key === "app:shopApp")!;
        // The app's own slots are on the app node (right column when selected).
        expect(shop.slots.map((s) => s.value)).toContain("shopApp.content");

        // The route is a child branch of its app.
        const route = shop.children.find((n) => n.key === "route:custRoute")!;
        expect(route).toBeTruthy();
        expect(route.kind).toBe("route");
        expect(route.slots.map((s) => s.value)).toEqual(["route:/customers/content"]);

        // The dialog is also a child branch of the app.
        expect(shop.children.some((n) => n.key === "dialog:confirmDlg")).toBe(true);

        // A child container nests directly under its PARENT NODE (the route),
        // not under a slot level — and recursively (innerC under cardC).
        const card = route.children.find((n) => n.key === "container:cardC")!;
        expect(card).toBeTruthy();
        expect(card.kind).toBe("container");
        expect(card.children.some((n) => n.key === "container:innerC")).toBe(true);

        // Slots remain the canonical mount strings (no data-format change).
        expect(card.slots.map((s) => s.value)).toEqual(["container:cardC/content"]);
        const inner = card.children.find((n) => n.key === "container:innerC")!;
        expect(inner.slots.map((s) => s.value)).toEqual(["container:innerC/content"]);
    });

    it("excludes the edited container's own subtree (cycle guard)", () => {
        const tree = common.buildMountPickerTree(multiAppReferences(), "cardC");
        const flat = JSON.stringify(tree);
        // Editing cardC's mount → neither cardC nor its descendant innerC appear.
        expect(flat).not.toContain("container:cardC");
        expect(flat).not.toContain("container:innerC");
        // The rest of the structure is intact.
        expect(flat).toContain("route:custRoute");
        expect(flat).toContain("app:adminApp");
    });

    it("findMountInTree returns the ancestor path + slot for a mount value", () => {
        const tree = common.buildMountPickerTree(multiAppReferences());

        const hit = common.findMountInTree(tree, "container:innerC/content");
        expect(hit).not.toBeNull();
        expect(hit!.slot).toBe("content");
        expect(hit!.path.map((n) => n.label)).toEqual(["Shop", "Customers", "Card", "Inner"]);

        const appHit = common.findMountInTree(tree, "shopApp.content");
        expect(appHit!.path.map((n) => n.label)).toEqual(["Shop"]);
        expect(appHit!.slot).toBe("content");

        // A non-resolvable mount yields null.
        expect(common.findMountInTree(tree, "route:/nope/content")).toBeNull();
        expect(common.findMountInTree(tree, "")).toBeNull();
    });

    it("the search-mode flat path list is still derivable via flattenMountOptionTree", () => {
        // P135 keeps flattenMountOptionTree(buildMountOptionsTree(...)) for the
        // search-mode flat path list + the field's label resolution.
        const entries = common.flattenMountOptionTree(
            common.buildMountOptionsTree(multiAppReferences())
        );
        const values = entries.map((e) => e.value);
        expect(values).toContain("route:/customers/content");
        expect(values).toContain("container:innerC/content");
    });
});
