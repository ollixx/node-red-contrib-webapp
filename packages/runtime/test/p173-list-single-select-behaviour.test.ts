import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
    };
};

const { runtimeNodeRegistry, renderAppPage } = webapp.__test__;

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...(reg.mapConfig(node) as Record<string, unknown>), z: node.z } : { ...node, id: node.id };
    });
}

/**
 * P173 — ui-list: Single-Select (selectable + selectedId TWO-WAY + selected state +
 * itemSelect). Resolves review W1 (itemSelect presumed a selection mode that did not
 * exist). Mirrors the ui-tabs `activeTab` two-way pattern (P155): `selectedId` reads
 * the selected id from the bound store/state and the itemSelect event carries the new
 * id for the wired write-back loop.
 */
describe("P173: ui-list mapConfig — selectable + selectedId", () => {
    const reg = runtimeNodeRegistry["ui-list"];

    function mapList(config: Record<string, unknown>) {
        return reg.mapConfig({ id: "l1", mount: "app1.content", ...config }) as Record<string, unknown>;
    }

    it("selectable=true passes through; absent → undefined (no selection state)", () => {
        expect(mapList({ items: { kind: "literal", value: [] }, selectable: true }).selectable).toBe(true);
        expect(mapList({ items: { kind: "literal", value: [] } }).selectable).toBeUndefined();
    });

    it("a stored selectedId binding object passes through", () => {
        const def = mapList({ items: { kind: "literal", value: [] }, selectedId: { kind: "store", path: "sel" } });
        expect(def.selectedId).toEqual({ kind: "store", path: "sel" });
    });

    it("a legacy selectedIdPath migrates to a state binding", () => {
        const def = mapList({ items: { kind: "literal", value: [] }, selectedIdPath: "current" });
        expect(def.selectedId).toEqual({ kind: "state", path: "current" });
    });
});

describe("P173: ui-list render — selected state + selectable interaction", () => {
    function listFlow(extra: Record<string, unknown>, items: unknown, store?: { id: string; path: string; value: unknown }) {
        const nodes: Record<string, unknown>[] = [
            { type: "ui-app", id: "sApp", name: "Sel", root: "sApp", layout: "app", z: "f1" }
        ];
        if (store) {
            nodes.push({ type: "ui-store", id: store.id, statePath: store.path, initialValue: JSON.stringify(store.value), z: "f1" });
        }
        nodes.push({ type: "ui-list", id: "sList", mount: "sApp.content", items, z: "f1", ...extra });
        return buildDefinitions(nodes);
    }

    const ITEMS = { kind: "literal", value: [{ id: "a", label: "Apple" }, { id: "b", label: "Banana" }, { id: "c", label: "Cherry" }] };

    it("selectable off → no aria-selected, no data-webapp-selectable, no selected class", () => {
        const result = renderAppPage("sApp", "/", undefined, listFlow({}, ITEMS));
        expect(result.status).toBe(200);
        expect(result.body).not.toContain("aria-selected");
        expect(result.body).not.toContain("data-webapp-selectable");
        // P183: the CSS stylesheet now contains ".webapp-list-item--selected" as a class name.
        // Use a tighter assertion: no HTML element should carry the class= attribute value.
        expect(result.body).not.toContain("class=\"webapp-list-item webapp-list-item--selected\"");
    });

    it("selectable on, literal selectedId → the matching row is marked selected", () => {
        const result = renderAppPage(
            "sApp",
            "/",
            undefined,
            listFlow({ selectable: true, selectedId: { kind: "literal", value: "b" } }, ITEMS)
        );
        expect(result.status).toBe(200);
        // The selectable rows carry the selectable hook + aria-selected.
        expect(result.body).toContain("data-webapp-selectable=\"true\"");
        // The matching row (id="b") is selected.
        expect(result.body).toContain("webapp-list-item webapp-list-item--selected");
        expect(result.body).toContain("aria-selected=\"true\"");
        // Exactly one row is selected.
        expect(result.body.match(/aria-selected="true"/g)?.length).toBe(1);
    });

    it("selectable on, selectedId resolves from a bound store (two-way READ) → marks that row", () => {
        const result = renderAppPage(
            "sApp",
            "/",
            undefined,
            listFlow(
                { selectable: true, selectedId: { kind: "store", path: "selStore" } },
                ITEMS,
                { id: "selStore", path: "selState", value: "c" }
            )
        );
        expect(result.status).toBe(200);
        // The store value "c" marks the Cherry row; one selected row.
        expect(result.body.match(/aria-selected="true"/g)?.length).toBe(1);
        // The selected <li> wraps the Cherry link.
        expect(result.body).toMatch(/webapp-list-item--selected[^>]*aria-selected="true"[\s\S]*?Cherry/);
    });

    it("selectable on but selectedId empty/invalid → no row marked selected", () => {
        const result = renderAppPage(
            "sApp",
            "/",
            undefined,
            listFlow({ selectable: true, selectedId: { kind: "literal", value: "nope" } }, ITEMS)
        );
        expect(result.status).toBe(200);
        // Selectable rows still carry the hook + aria-selected="false", but none true.
        expect(result.body).toContain("data-webapp-selectable=\"true\"");
        expect(result.body).not.toContain("aria-selected=\"true\"");
        // P183: CSS stylesheet contains ".webapp-list-item--selected"; check no element has the class attr.
        expect(result.body).not.toContain("class=\"webapp-list-item webapp-list-item--selected\"");
    });

    it("selectable on WITHOUT itemClick still makes rows interactive (click drives selection)", () => {
        const result = renderAppPage(
            "sApp",
            "/",
            undefined,
            listFlow({ selectable: true, selectedId: { kind: "literal", value: "a" } }, ITEMS)
        );
        expect(result.status).toBe(200);
        // No itemClick event declared, yet rows carry the click hook + item id because
        // the list is selectable.
        expect(result.body).toContain("data-webapp-event=\"click\"");
        expect(result.body).toContain("data-webapp-item=\"a\"");
    });

    it("no id on an item → array index is the rowId fallback for selection", () => {
        const result = renderAppPage(
            "sApp",
            "/",
            undefined,
            listFlow(
                { selectable: true, selectedId: { kind: "literal", value: "1" } },
                { kind: "literal", value: ["Zero", "One", "Two"] }
            )
        );
        expect(result.status).toBe(200);
        // Index 1 ("One") is selected via the index fallback rowId.
        expect(result.body.match(/aria-selected="true"/g)?.length).toBe(1);
        expect(result.body).toMatch(/webapp-list-item--selected[^>]*aria-selected="true"[\s\S]*?One/);
    });
});
