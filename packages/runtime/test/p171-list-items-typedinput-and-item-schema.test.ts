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
 * P171 — ui-list: items as a STRUCTURAL value typedInput + item-schema contract.
 *
 * mapConfig: `items` is a structural array binding (the list renders its rows
 * ITSELF — NOT a repeats case), exactly like ui-menu `items`. A json-literal binding
 * keeps its array shape; a store/query binding passes through for structural
 * resolution; a legacy `itemsPath` plain path migrates to a state binding (PRECISE:
 * a leading `state.` is stripped → never `state.state.…`). `displayValue` /
 * `badgeVariant` are node-wide DISPLAY fields.
 */
describe("P171: ui-list mapConfig — items (structural) + migration + display fields", () => {
    const reg = runtimeNodeRegistry["ui-list"];

    function mapList(config: Record<string, unknown>) {
        return reg.mapConfig({ id: "l1", mount: "app1.content", ...config }) as Record<string, unknown>;
    }

    it("a store items binding passes through (structural resolution)", () => {
        const def = mapList({ items: { kind: "store", path: "people" } });
        expect(def.items).toEqual({ kind: "store", path: "people" });
    });

    it("a query items binding passes through", () => {
        const def = mapList({ items: { kind: "query", path: "rows" } });
        expect(def.items).toEqual({ kind: "query", path: "rows" });
    });

    it("migration — legacy itemsPath becomes a state binding (whole string is the path)", () => {
        const def = mapList({ itemsPath: "people" });
        expect(def.items).toEqual({ kind: "state", path: "people" });
    });

    it("migration — a leading `state.` prefix is stripped (never state.state.…)", () => {
        const def = mapList({ itemsPath: "state.foo.bar" });
        expect(def.items).toEqual({ kind: "state", path: "foo.bar" });
    });

    it("displayValue + badgeVariant are carried node-wide", () => {
        const def = mapList({ items: { kind: "literal", value: [] }, displayValue: "badge", badgeVariant: "warning" });
        expect(def.displayValue).toBe("badge");
        expect(def.badgeVariant).toBe("warning");
    });
});

/**
 * Render-resolution end to end: the item-schema contract (String shorthand,
 * object form, missing label → "?", non-array root → empty list), value display
 * via `displayValue`, and the itemClick wiring.
 */
describe("P171: ui-list — item-schema render + value display", () => {
    it("array of strings → one labelled <li> per string", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "lApp1", name: "List", root: "lApp1", layout: "app", z: "f1" },
            { type: "ui-list", id: "lNode1", mount: "lApp1.content", items: { kind: "literal", value: ["Ada", "Alan"] }, z: "f1" }
        ]);

        const result = renderAppPage("lApp1", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("<ul class=\"webapp-list\">");
        expect(result.body).toContain(">Ada</li>");
        expect(result.body).toContain(">Alan</li>");
    });

    it("mixed array renders; an object missing `label` → '?' for that row only", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "lApp2", name: "List", root: "lApp2", layout: "app", z: "f1" },
            {
                type: "ui-list",
                id: "lNode2",
                mount: "lApp2.content",
                items: { kind: "literal", value: ["Shortcut", { id: "c-1", label: "Open invoices" }, { id: "c-2", value: 7 }] },
                z: "f1"
            }
        ]);

        const result = renderAppPage("lApp2", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain(">Shortcut</li>");
        expect(result.body).toContain("Open invoices");
        // The label-less object renders the non-displayable hint "?".
        expect(result.body).toContain(">?</li>");
    });

    it("a non-array store root → empty list (no rows, no crash)", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "lApp3", name: "List", root: "lApp3", layout: "app", z: "f1" },
            { type: "ui-store", id: "lStore3", statePath: "scalar", initialValue: JSON.stringify("hello"), z: "f1" },
            { type: "ui-list", id: "lNode3", mount: "lApp3.content", items: { kind: "store", path: "lStore3" }, z: "f1" }
        ]);

        const result = renderAppPage("lApp3", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("<ul class=\"webapp-list\"></ul>");
    });

    it("displayValue=badge renders value as an sl-badge in badgeVariant", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "lApp4", name: "List", root: "lApp4", layout: "app", z: "f1" },
            {
                type: "ui-list",
                id: "lNode4",
                mount: "lApp4.content",
                items: { kind: "literal", value: [{ id: "c-1", label: "Open", value: 3 }] },
                displayValue: "badge",
                badgeVariant: "warning",
                z: "f1"
            }
        ]);

        const result = renderAppPage("lApp4", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("<sl-badge class=\"webapp-list-value\" variant=\"warning\">3</sl-badge>");
    });

    it("displayValue=secondary renders value as trailing text (not a badge)", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "lApp5", name: "List", root: "lApp5", layout: "app", z: "f1" },
            {
                type: "ui-list",
                id: "lNode5",
                mount: "lApp5.content",
                items: { kind: "literal", value: [{ label: "Open", value: 3 }] },
                displayValue: "secondary",
                z: "f1"
            }
        ]);

        const result = renderAppPage("lApp5", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("<span class=\"webapp-list-value\">3</span>");
        expect(result.body).not.toContain("sl-badge");
    });

    it("default displayValue=none → value NOT displayed, but the row carries it for the event", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "lApp6", name: "List", root: "lApp6", layout: "app", z: "f1" },
            {
                type: "ui-list",
                id: "lNode6",
                mount: "lApp6.content",
                items: { kind: "literal", value: [{ id: "c-1", label: "Open", value: 3 }] },
                events: ["itemClick"],
                z: "f1"
            }
        ]);

        const result = renderAppPage("lApp6", "/", undefined, definitions);
        expect(result.status).toBe(200);
        // value 3 is NOT shown (no badge / secondary span)…
        expect(result.body).not.toContain("webapp-list-value");
        // …but the whole element (incl. value) rides in data-webapp-row for the event.
        expect(result.body).toContain("data-webapp-item=\"c-1\"");
        expect(result.body).toContain("&quot;value&quot;:3");
    });

    it("a legacy itemsPath still renders the list from the store", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "lApp7", name: "List", root: "lApp7", layout: "app", z: "f1" },
            { type: "ui-store", id: "lStore7", statePath: "people", initialValue: JSON.stringify([{ label: "Grace" }]), z: "f1" },
            { type: "ui-list", id: "lNode7", mount: "lApp7.content", itemsPath: "people", z: "f1" }
        ]);

        const result = renderAppPage("lApp7", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain(">Grace</li>");
    });
});
