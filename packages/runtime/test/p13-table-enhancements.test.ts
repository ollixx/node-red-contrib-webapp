import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { assembleNodeSet } from "../src";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
    };
};

const { runtimeNodeRegistry } = webapp.__test__;

const baseTableConfig = {
    id: "t1",
    parent: "app1/route1/content",
    rowsPath: "customers.list"
};

describe("P13: ui-table — structured column parsing", () => {
    it("plain string columns produce {key, label} entries", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: "name,email"
        }) as { columns: { key: string; label: string }[] };

        expect(def.columns).toHaveLength(2);
        expect(def.columns[0]).toMatchObject({ key: "name", label: "name" });
        expect(def.columns[1]).toMatchObject({ key: "email", label: "email" });
    });

    it("structured column object uses label over key for display", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: [{ key: "firstName", label: "Vorname" }]
        }) as { columns: { key: string; label: string }[] };

        expect(def.columns).toHaveLength(1);
        expect(def.columns[0]).toMatchObject({ key: "firstName", label: "Vorname" });
    });

    it("structured column with no label defaults label to key", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: [{ key: "status" }]
        }) as { columns: { key: string; label: string }[] };

        expect(def.columns[0]).toMatchObject({ key: "status", label: "status" });
    });

    it("structured column passes through type, sortable, filterable, width", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: [{ key: "active", label: "Aktiv", type: "checkbox", sortable: true, filterable: false, width: 80 }]
        }) as { columns: Record<string, unknown>[] };

        expect(def.columns[0]).toMatchObject({
            key: "active",
            label: "Aktiv",
            type: "checkbox",
            sortable: true,
            filterable: false,
            width: 80
        });
    });

    it("mixed string and structured columns are parsed correctly", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: ["name", { key: "city", label: "Stadt" }]
        }) as { columns: { key: string; label: string }[] };

        expect(def.columns).toHaveLength(2);
        expect(def.columns[0]).toMatchObject({ key: "name", label: "name" });
        expect(def.columns[1]).toMatchObject({ key: "city", label: "Stadt" });
    });
});

describe("P13: ui-table — footer slot", () => {
    it("footer=true exposes footer flag in compiled config", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: "name",
            footer: true
        }) as { footer: boolean };

        expect(def.footer).toBe(true);
    });

    it("footer omitted defaults to false", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: "name"
        }) as { footer: boolean };

        expect(def.footer).toBe(false);
    });

    it("assembleNodeSet: table with footer=true exposes footer in compiled component props", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", title: "Test App", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-table",
                id: "table1",
                mount: "route:/test/content",
                columns: [{ key: "name", label: "Name" }],
                rows: { kind: "query", path: "items.list" },
                footer: true
            }
        ]);

        expect(assembly.success).toBe(true);
        if (!assembly.success) return;

        const tableContrib = assembly.data.contributions.find(
            (c) => c.kind === "component" && c.definition.id === "table1"
        );

        expect(tableContrib).toBeDefined();
        if (!tableContrib || tableContrib.kind !== "component") return;

        expect((tableContrib.definition.props as Record<string, unknown>).footer).toBe(true);
    });
});

describe("P13: ui-table — configurable row events", () => {
    it("events=[rowSelect] produces events array of length 1", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: "name",
            events: ["rowSelect"]
        }) as { events: string[] };

        expect(def.events).toEqual(["rowSelect"]);
    });

    it("events=[rowSelect, rowAction] produces events array of length 2", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: "name",
            events: ["rowSelect", "rowAction"]
        }) as { events: string[] };

        expect(def.events).toHaveLength(2);
    });

    it("no events and no selectAction produces empty events array", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: "name"
        }) as { events: string[] | undefined };

        expect(def.events == null || def.events.length === 0).toBe(true);
    });
});

describe("P13: ui-table — selectAction backward compatibility", () => {
    it("existing flow with selectAction still compiles without error", () => {
        const assembly = assembleNodeSet([
            { type: "ui-app", id: "app1", title: "Test App", layout: "app" },
            { type: "ui-route", id: "route1", path: "/test", layout: "vertical" },
            {
                type: "ui-table",
                id: "legacyTable",
                mount: "route:/test/content",
                columns: ["name", "email"],
                rows: { kind: "query", path: "customers.list" },
                selectAction: "openCustomerDetail"
            }
        ]);

        expect(assembly.success).toBe(true);
    });

    it("selectAction is preserved in mapConfig output", () => {
        const def = runtimeNodeRegistry["ui-table"].mapConfig({
            ...baseTableConfig,
            columns: "name",
            selectAction: "openDetail"
        }) as { selectAction?: string };

        expect(def.selectAction).toBe("openDetail");
    });
});
