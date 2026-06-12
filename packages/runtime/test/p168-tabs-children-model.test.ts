import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
        migrateLegacyTabComponents: (components: Record<string, unknown>[]) => Record<string, unknown>[];
        validateUiTabChildrenUniqueness: (RED: unknown) => Array<{ nodeId: string; host: string; tabId: string; message: string }>;
    };
};

const { runtimeNodeRegistry, renderAppPage, migrateLegacyTabComponents, validateUiTabChildrenUniqueness } = webapp.__test__;

function fakeRedWithFlow(nodes: unknown[]) {
    const dir = mkdtempSync(join(tmpdir(), "p168-flow-"));
    const flowFile = join(dir, "flows.json");
    writeFileSync(flowFile, JSON.stringify(nodes), "utf8");
    return { settings: { flowFile } };
}

function build(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig
            ? { ...reg.mapConfig(node), z: node.z, id: node.id, uiId: node.id }
            : { ...node };
    });
}

/**
 * P168 (ADR 0018, Model 1a) — ui-tabs/ui-tab children model: the renderer derives
 * one panel per ui-tab child, the legacy tabs-JSON flow migrates, and content
 * mounts into the tab's content slot.
 */
describe("P168: ui-tabs/ui-tab children model — renderer", () => {
    function tabsFlow(active?: { kind: string; value?: string; path?: string }) {
        return build([
            { type: "ui-app", id: "P168App", name: "Tabs", root: "P168App", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "TB", mount: "P168App.content", ...(active ? { activeTab: active } : {}), z: "f1" },
            { type: "ui-tab", id: "ov", mount: "ui-tabs:TB/content", label: { kind: "literal", value: "Overview" }, order: 0, z: "f1" },
            { type: "ui-tab", id: "de", mount: "ui-tabs:TB/content", label: { kind: "literal", value: "Details" }, order: 1, z: "f1" },
            { type: "ui-text", id: "ovBody", mount: "ui-tab:ov/content", text: "Overview body", z: "f1" },
            { type: "ui-text", id: "deBody", mount: "ui-tab:de/content", text: "Details body", z: "f1" }
        ]);
    }

    it("renders one sl-tab + sl-tab-panel per ui-tab child, content in the panel", () => {
        const result = renderAppPage("P168App", "/", undefined, tabsFlow({ kind: "literal", value: "ov" }));
        expect(result.status).toBe(200);
        expect(result.body).toContain("panel=\"ov\"");
        expect(result.body).toContain("panel=\"de\"");
        expect(result.body).toContain("name=\"ov\"");
        expect(result.body).toContain("name=\"de\"");
        expect(result.body).toContain("Overview body");
        expect(result.body).toContain("Details body");
        expect(result.body).toContain(">Overview</sl-tab>");
        expect(result.body).toContain(">Details</sl-tab>");
    });

    it("marks the activeTab child active; an invalid value falls back to the first child", () => {
        const active = renderAppPage("P168App", "/", undefined, tabsFlow({ kind: "literal", value: "de" }));
        expect(active.body).toContain("panel=\"de\" active");

        const invalid = renderAppPage("P168App", "/", undefined, tabsFlow({ kind: "literal", value: "nope" }));
        // falls back to the first child by order ("ov").
        expect(invalid.body).toContain("panel=\"ov\" active");

        const none = renderAppPage("P168App", "/", undefined, tabsFlow());
        expect(none.body).toContain("panel=\"ov\" active");
    });

    it("accepts the container:<id>/content mount alias the editor picker emits", () => {
        const defs = build([
            { type: "ui-app", id: "P168Alias", name: "Tabs", root: "P168Alias", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "TB2", mount: "P168Alias.content", activeTab: { kind: "literal", value: "a" }, z: "f1" },
            { type: "ui-tab", id: "a", mount: "container:TB2/content", label: { kind: "literal", value: "A" }, order: 0, z: "f1" },
            { type: "ui-text", id: "aBody", mount: "container:a/content", text: "A body", z: "f1" }
        ]);
        const result = renderAppPage("P168Alias", "/", undefined, defs);
        expect(result.status).toBe(200);
        expect(result.body).toContain("panel=\"a\"");
        expect(result.body).toContain("A body");
    });
});

describe("P168: legacy tabs-JSON migration (migrateLegacyTabComponents)", () => {
    it("synthesizes ui-tab children and re-points tab:<id> content mounts", () => {
        // Components as ui-tabs mapConfig emits them (legacyTabs carrier preserved).
        const tabsDef = runtimeNodeRegistry["ui-tabs"].mapConfig({
            id: "LTB",
            mount: "app.content",
            tabs: JSON.stringify([{ id: "x", label: "X" }, { id: "y", label: "Y" }])
        });

        const migrated = migrateLegacyTabComponents([
            { ...tabsDef, id: "LTB" },
            { type: "ui-text", id: "c1", mount: "tab:x", text: "X body" }
        ]);

        // ui-tabs no longer carries the legacy carriers.
        const tabsNode = migrated.find((c) => c.type === "ui-tabs");
        expect(tabsNode?.tabs).toBeUndefined();
        expect(tabsNode?.legacyTabs).toBeUndefined();

        // one synthesized ui-tab per legacy entry, mounted into the ui-tabs slot.
        const tabChildren = migrated.filter((c) => c.type === "ui-tab");
        expect(tabChildren).toHaveLength(2);
        expect(tabChildren.map((t) => t.id).sort()).toEqual(["x", "y"]);
        expect(tabChildren.find((t) => t.id === "x")?.mount).toBe("ui-tabs:LTB/content");

        // the content child is re-pointed onto the new ui-tab content slot.
        const content = migrated.find((c) => c.id === "c1");
        expect(content?.mount).toBe("ui-tab:x/content");
    });

    it("passes a children-model flow through untouched (no legacy carriers)", () => {
        const components = [
            { type: "ui-tabs", id: "NB", mount: "app.content" },
            { type: "ui-tab", id: "t", mount: "ui-tabs:NB/content", label: { kind: "literal", value: "T" } }
        ];
        const migrated = migrateLegacyTabComponents(components);
        expect(migrated).toEqual(components);
    });

    it("end-to-end: a legacy tabs flow renders the migrated tabs + content", () => {
        const defs = build([
            { type: "ui-app", id: "P168Leg", name: "Tabs", root: "P168Leg", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "LG", mount: "P168Leg.content", tabs: JSON.stringify([{ id: "ov", label: "Overview" }, { id: "de", label: "Details" }]), activeTab: { kind: "literal", value: "de" }, z: "f1" },
            { type: "ui-text", id: "lc", mount: "tab:ov", text: "Legacy Overview body", z: "f1" }
        ]);
        const result = renderAppPage("P168Leg", "/", undefined, defs);
        expect(result.status).toBe(200);
        expect(result.body).toContain("panel=\"de\" active");
        expect(result.body).toContain("Legacy Overview body");
        expect(result.body).toContain(">Overview</sl-tab>");
    });
});

/**
 * P168 (ADR 0018 §1) — uniqueness: two ui-tab children with the same id under one
 * ui-tabs surface a visible deploy error (one issue per offending node). The
 * check groups by the ui-tabs id parsed from each ui-tab's mount.
 */
describe("P168: ui-tab id uniqueness validation (validateUiTabChildrenUniqueness)", () => {
    it("reports an issue per node for a duplicate tab id within one ui-tabs", () => {
        const RED = fakeRedWithFlow([
            { type: "ui-app", id: "A", root: "A" },
            { type: "ui-tabs", id: "TB", mount: "A.content" },
            { type: "ui-tab", id: "dup", mount: "ui-tabs:TB/content" },
            { type: "ui-tab", id: "dup", mount: "container:TB/content" }
        ]);
        const issues = validateUiTabChildrenUniqueness(RED);
        expect(issues).toHaveLength(2);
        expect(issues[0].tabId).toBe("dup");
        expect(issues[0].host).toBe("TB");
        expect(issues[0].message).toMatch(/Duplicate ui-tab id 'dup'/);
    });

    it("does not flag the same tab id under DIFFERENT ui-tabs hosts", () => {
        const RED = fakeRedWithFlow([
            { type: "ui-tabs", id: "TB1", mount: "A.content" },
            { type: "ui-tabs", id: "TB2", mount: "A.content" },
            { type: "ui-tab", id: "same", mount: "ui-tabs:TB1/content" },
            { type: "ui-tab", id: "same", mount: "ui-tabs:TB2/content" }
        ]);
        expect(validateUiTabChildrenUniqueness(RED)).toHaveLength(0);
    });

    it("returns no issues for unique tab ids", () => {
        const RED = fakeRedWithFlow([
            { type: "ui-tabs", id: "TB", mount: "A.content" },
            { type: "ui-tab", id: "ov", mount: "ui-tabs:TB/content" },
            { type: "ui-tab", id: "de", mount: "ui-tabs:TB/content" }
        ]);
        expect(validateUiTabChildrenUniqueness(RED)).toHaveLength(0);
    });
});
