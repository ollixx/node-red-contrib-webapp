import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * P214 (ADR 0030) — the `stores` reference preset lists each ui-query's implicit
 * params target ALONGSIDE the real ui-store nodes, visibly distinguishable
 * ("Query X · Params"). Selecting one stores the QUERY id as the reference value.
 *
 * `resources/lib/editor-common.js` is a browser IIFE; its `nodePickerPresets`
 * helpers touch neither jQuery nor RED, so we load the file in a vm and exercise
 * the pure preset directly. No DOM, no Playwright.
 */

interface Entry { value: string; label: string; name: string; id: string; type: string; secondary?: string }
interface EditorCommon {
    nodePickerPresets: {
        stores: (references: unknown, context?: { appId?: string }) => Entry[];
    };
}

let common: EditorCommon;

beforeAll(() => {
    const editorCommonPath = fileURLToPath(new URL("../../../resources/lib/editor-common.js", import.meta.url));
    const source = readFileSync(editorCommonPath, "utf8");
    const sandbox: Record<string, unknown> = {};
    sandbox.window = sandbox;
    createContext(sandbox);
    runInContext(source, sandbox);
    common = sandbox.WebappEditorCommon as EditorCommon;
});

function buildReferences() {
    return {
        apps: [{ id: "app", title: "Shop" }],
        routes: [],
        dialogs: [],
        containers: [],
        actions: [],
        stores: [{ id: "realStore", name: "filters", statePath: "draft.filters", parent: "app" }],
        queries: [
            { id: "entitiesQuery", name: "Entities", queryPath: "entities", parent: "app" },
            { id: "otherQuery", name: "", queryPath: "widgets", parent: "app" }
        ]
    };
}

describe("P214 stores preset lists implicit query-params targets", () => {
    it("includes a params entry per query, labelled and valued by the query id", () => {
        const entries = common.nodePickerPresets.stores(buildReferences(), { appId: "app" });
        const byValue = new Map(entries.map((e) => [e.value, e]));

        // The real store is still present, unchanged.
        expect(byValue.get("realStore")).toMatchObject({ type: "ui-store", value: "realStore" });

        // The named query surfaces a params target keyed by the QUERY id.
        const named = byValue.get("entitiesQuery");
        expect(named).toBeDefined();
        expect(named!.value).toBe("entitiesQuery");
        expect(named!.type).toBe("ui-query-params");
        expect(named!.name).toBe("Query Entities · Params");
        expect(named!.label).toContain("Query Entities · Params");
        expect(named!.label).toContain("ui.queries.entities.params");

        // An unnamed query falls back to its id in the label.
        const unnamed = byValue.get("otherQuery");
        expect(unnamed).toBeDefined();
        expect(unnamed!.name).toBe("Query otherQuery · Params");
    });

    it("app-scoping filters query params by parent, like real stores", () => {
        const refs = buildReferences();
        refs.queries.push({ id: "foreignQuery", name: "Foreign", queryPath: "x", parent: "otherApp" });
        const entries = common.nodePickerPresets.stores(refs, { appId: "app" });
        const values = entries.map((e) => e.value);
        expect(values).toContain("entitiesQuery");
        expect(values).not.toContain("foreignQuery");
    });
});
