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
 * P155 (ADR 0012) — ui-tabs activeTab canonical value typedInput.
 *
 * `activeTabPath` → `activeTab` (canonical value typedInput, TWO-WAY: reads the
 * active tab id from a Store/state binding AND, on tab change, the `change`
 * event carries the new tab so a wired flow writes it back). The canonical field
 * carries a binding OBJECT; the legacy plain-string `activeTabPath` migrates
 * losslessly to `{kind:"state", path}`.
 *
 * P168 (ADR 0018, Model 1a): the `tabs` config-array is gone — tabs are derived
 * from the mounted `ui-tab` children. The mapConfig assertions below no longer
 * pass a `tabs` field; the read-resolution block mounts two `ui-tab` children.
 */
describe("P155: ui-tabs — activeTab canonical typedInput", () => {
    const reg = runtimeNodeRegistry["ui-tabs"];

    it("canonical activeTab binding object drives activeTab", () => {
        const def = reg.mapConfig({
            id: "tb1",
            mount: "app1.content",
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
            mount: "app1.content"
        }) as Record<string, unknown>;

        expect(def.activeTab).toBeUndefined();
    });

    it("the tabChange event is preserved alongside the activeTab binding", () => {
        const def = reg.mapConfig({
            id: "tb7",
            mount: "app1.content",
            activeTab: { kind: "state", path: "view.tab" },
            events: JSON.stringify(["tabChange"])
        }) as Record<string, unknown>;

        expect(def.events).toEqual(["tabChange"]);
    });
});

/**
 * P155/P168 read-resolution: the activeTab binding routes through bind.value, so
 * the renderer resolves the active tab id (literal / store / state source). Under
 * the Model-1a children model (P168) the renderer enumerates the `ui-tab`
 * children and marks the matching <sl-tab> active. An absent/invalid value falls
 * back to the first child by order (defaultActiveTabId).
 */
describe("P155/P168: ui-tabs — activeTab read-resolution into the active sl-tab", () => {
    function tabChildren(tabsId: string) {
        return [
            { type: "ui-tab", id: "overview", mount: `ui-tabs:${tabsId}/content`, label: { kind: "literal", value: "Overview" }, order: 0, z: "f1" },
            { type: "ui-tab", id: "details", mount: `ui-tabs:${tabsId}/content`, label: { kind: "literal", value: "Details" }, order: 1, z: "f1" }
        ];
    }

    it("a literal activeTab marks the matching sl-tab active", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp", name: "Tabs", root: "tabsResApp", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "tabsRes1", mount: "tabsResApp.content", activeTab: { kind: "literal", value: "details" }, z: "f1" },
            ...tabChildren("tabsRes1")
        ]);

        const result = renderAppPage("tabsResApp", "/", undefined, definitions);
        expect(result.status).toBe(200);
        // the "details" sl-tab carries the active flag; "overview" does not.
        expect(result.body).toContain("panel=\"details\" data-webapp-part=\"details\" active");
        expect(result.body).toContain("panel=\"overview\" data-webapp-part=\"overview\">");
        // each child contributes its own panel.
        expect(result.body).toContain("name=\"overview\"");
        expect(result.body).toContain("name=\"details\"");
        // labels come from the resolved per-child label binding.
        expect(result.body).toContain("Overview");
        expect(result.body).toContain("Details");
    });

    it("a state activeTab resolves the active tab from the store", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp2", name: "Tabs", root: "tabsResApp2", layout: "app", z: "f1" },
            { type: "ui-store", id: "tabsResStore", statePath: "view", initialValue: JSON.stringify({ tab: "details" }), z: "f1" },
            { type: "ui-tabs", id: "tabsRes2", mount: "tabsResApp2.content", activeTab: { kind: "state", path: "view.tab" }, z: "f1" },
            ...tabChildren("tabsRes2")
        ]);

        const result = renderAppPage("tabsResApp2", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("panel=\"details\" data-webapp-part=\"details\" active");
    });

    it("a legacy activeTabPath still resolves the active tab from the store", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp3", name: "Tabs", root: "tabsResApp3", layout: "app", z: "f1" },
            { type: "ui-store", id: "tabsResStore3", statePath: "view", initialValue: JSON.stringify({ tab: "overview" }), z: "f1" },
            { type: "ui-tabs", id: "tabsRes3", mount: "tabsResApp3.content", activeTabPath: "view.tab", z: "f1" },
            ...tabChildren("tabsRes3")
        ]);

        const result = renderAppPage("tabsResApp3", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("panel=\"overview\" data-webapp-part=\"overview\" active");
    });

    it("no activeTab falls back to the first child by order", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp4", name: "Tabs", root: "tabsResApp4", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "tabsRes4", mount: "tabsResApp4.content", z: "f1" },
            ...tabChildren("tabsRes4")
        ]);

        const result = renderAppPage("tabsResApp4", "/", undefined, definitions);
        expect(result.status).toBe(200);
        // first child by order ("overview", order 0) is the default active tab.
        expect(result.body).toContain("panel=\"overview\" data-webapp-part=\"overview\" active");
    });

    it("renders each ui-tab child's content into its own panel", () => {
        const definitions = buildDefinitions([
            { type: "ui-app", id: "tabsResApp5", name: "Tabs", root: "tabsResApp5", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "tabsRes5", mount: "tabsResApp5.content", activeTab: { kind: "literal", value: "overview" }, z: "f1" },
            ...tabChildren("tabsRes5"),
            { type: "ui-text", id: "txtOverview", mount: "ui-tab:overview/content", text: "Overview body", z: "f1" },
            { type: "ui-text", id: "txtDetails", mount: "ui-tab:details/content", text: "Details body", z: "f1" }
        ]);

        const result = renderAppPage("tabsResApp5", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("Overview body");
        expect(result.body).toContain("Details body");
        // content sits inside the per-tab panels.
        expect(result.body).toContain("name=\"overview\">");
    });
});
