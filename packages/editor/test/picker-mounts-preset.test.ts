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

interface EditorCommon {
    buildMountOptionsTree: (references: unknown) => Array<{ label: string; options: Array<{ value?: string; label: string; disabled?: boolean }> }>;
    flattenMountOptionTree: (groups: unknown) => Entry[];
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
