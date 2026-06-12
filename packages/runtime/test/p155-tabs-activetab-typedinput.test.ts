import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => unknown }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
        getAppModelResult: (appId: string, definitions: unknown[]) => { success: boolean; model?: unknown };
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
 * P155 (ADR 0012) — ui-tabs field-typing wave 2.
 *
 * `activeTabPath` → `activeTab` (canonical value typedInput, TWO-WAY: reads the
 * active tab from a Store/state binding AND, on tab change, the existing
 * `tabChange` event carries the new tab so a wired flow writes it back). The
 * canonical field carries a binding OBJECT; the legacy plain-string
 * `activeTabPath` migrates losslessly to `{kind:"state", path}`.
 *
 * Scope is ONLY the active tab — the `tabs` list is out of scope.
 */
describe("P155: ui-tabs — activeTab canonical typedInput", () => {
    const reg = runtimeNodeRegistry["ui-tabs"];

    it("canonical activeTab binding object drives activeTab", () => {
        const def = reg.mapConfig({
            id: "tb1",
            mount: "app1.content",
            tabs: JSON.stringify([{ id: "a", label: "A" }]),
            activeTab: { kind: "state", path: "view.tab" }
        }) as Record<string, unknown>;

        const activeTab = def.activeTab as Record<string, unknown> | undefined;
        expect(activeTab?.kind).toBe("state");
        expect(activeTab?.path).toBe("view.tab");
    });

    it("activeTab accepts a store binding (two-way source)", () => {
        const def = reg.mapConfig({
            id: "tb2",
            mount: "app1.content",
            tabs: JSON.stringify([{ id: "a", label: "A" }]),
            activeTab: { kind: "store", storeId: "s", path: "tab" }
        }) as Record<string, unknown>;

        const activeTab = def.activeTab as Record<string, unknown> | undefined;
        expect(activeTab?.kind).toBe("store");
        expect(activeTab?.path).toBe("tab");
    });

    it("activeTab accepts a literal binding (tab id string)", () => {
        const def = reg.mapConfig({
            id: "tb3",
            mount: "app1.content",
            tabs: JSON.stringify([{ id: "a", label: "A" }]),
            activeTab: { kind: "literal", value: "details" }
        }) as Record<string, unknown>;

        const activeTab = def.activeTab as Record<string, unknown> | undefined;
        expect(activeTab?.kind).toBe("literal");
        expect(activeTab?.value).toBe("details");
    });

    it("legacy activeTabPath migrates to a state binding", () => {
        const def = reg.mapConfig({
            id: "tb4",
            mount: "app1.content",
            tabs: JSON.stringify([{ id: "a", label: "A" }]),
            activeTabPath: "view.tab"
        }) as Record<string, unknown>;

        const activeTab = def.activeTab as Record<string, unknown> | undefined;
        expect(activeTab?.kind).toBe("state");
        expect(activeTab?.path).toBe("view.tab");
    });

    it("canonical activeTab wins over legacy activeTabPath when both present", () => {
        const def = reg.mapConfig({
            id: "tb5",
            mount: "app1.content",
            tabs: JSON.stringify([{ id: "a", label: "A" }]),
            activeTab: { kind: "store", storeId: "s", path: "tab" },
            activeTabPath: "legacy.tab"
        }) as Record<string, unknown>;

        const activeTab = def.activeTab as Record<string, unknown> | undefined;
        expect(activeTab?.kind).toBe("store");
        expect(activeTab?.path).toBe("tab");
    });

    it("no activeTab and no activeTabPath leaves activeTab undefined", () => {
        const def = reg.mapConfig({
            id: "tb6",
            mount: "app1.content",
            tabs: JSON.stringify([{ id: "a", label: "A" }])
        }) as Record<string, unknown>;

        expect(def.activeTab).toBeUndefined();
    });

    it("the tabChange event is preserved alongside the activeTab binding", () => {
        const def = reg.mapConfig({
            id: "tb7",
            mount: "app1.content",
            tabs: JSON.stringify([{ id: "a", label: "A" }]),
            activeTab: { kind: "state", path: "view.tab" },
            events: JSON.stringify(["tabChange"])
        }) as Record<string, unknown>;

        expect(def.events).toEqual(["tabChange"]);
    });
});

/**
 * P155 read-resolution: the activeTab binding routes through bind.value, so the
 * renderer resolves the active tab id (literal / store / state source) and the
 * serializer marks the matching <sl-tab> active. This is the SAME read path
 * P154 established for ui-pagination currentPage.
 */
describe("P155: ui-tabs — activeTab read-resolution into the active sl-tab", () => {
    const tabs = JSON.stringify([
        { id: "overview", label: "Overview" },
        { id: "details", label: "Details" }
    ]);

    it("a literal activeTab marks the matching sl-tab active", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp", name: "Tabs", root: "tabsResApp", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "tabsRes1", mount: "tabsResApp.content", tabs, activeTab: { kind: "literal", value: "details" }, z: "f1" }
        ]);

        const result = renderAppPage("tabsResApp", "/", undefined, definitions);
        expect(result.status).toBe(200);
        // the "details" sl-tab carries the active flag; "overview" does not.
        expect(result.body).toContain("panel=\"details\" active");
        expect(result.body).toContain("panel=\"overview\">");
    });

    it("a state activeTab resolves the active tab from the store", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp2", name: "Tabs", root: "tabsResApp2", layout: "app", z: "f1" },
            { type: "ui-store", id: "tabsResStore", statePath: "view", initialValue: JSON.stringify({ tab: "details" }), z: "f1" },
            { type: "ui-tabs", id: "tabsRes2", mount: "tabsResApp2.content", tabs, activeTab: { kind: "state", path: "view.tab" }, z: "f1" }
        ]);

        const result = renderAppPage("tabsResApp2", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("panel=\"details\" active");
    });

    it("a legacy activeTabPath still resolves the active tab from the store", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp3", name: "Tabs", root: "tabsResApp3", layout: "app", z: "f1" },
            { type: "ui-store", id: "tabsResStore3", statePath: "view", initialValue: JSON.stringify({ tab: "overview" }), z: "f1" },
            { type: "ui-tabs", id: "tabsRes3", mount: "tabsResApp3.content", tabs, activeTabPath: "view.tab", z: "f1" }
        ]);

        const result = renderAppPage("tabsResApp3", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("panel=\"overview\" active");
    });
});
