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
        migrateLegacyAccordionComponents: (components: Record<string, unknown>[]) => Record<string, unknown>[];
        validateUiAccordionSectionChildrenUniqueness: (RED: unknown) => Array<{ nodeId: string; host: string; sectionId: string; message: string }>;
    };
};

const { runtimeNodeRegistry, renderAppPage, migrateLegacyAccordionComponents, validateUiAccordionSectionChildrenUniqueness } = webapp.__test__;

function fakeRedWithFlow(nodes: unknown[]) {
    const dir = mkdtempSync(join(tmpdir(), "p169-flow-"));
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
 * P169 (ADR 0018, Model 1a) — ui-accordion/ui-accordion-section children model:
 * the renderer derives one collapsible panel per ui-accordion-section child, the
 * legacy sections-JSON flow migrates, and content mounts into the section's
 * content slot. Mirror of p168-tabs-children-model.
 */
describe("P169: ui-accordion/ui-accordion-section children model — renderer", () => {
    function accordionFlow(open?: { kind: string; value?: string; path?: string }) {
        return build([
            { type: "ui-app", id: "P169App", name: "Acc", root: "P169App", layout: "app", z: "f1" },
            { type: "ui-accordion", id: "AC", mount: "P169App.content", ...(open ? { openSection: open } : {}), z: "f1" },
            { type: "ui-accordion-section", id: "ov", mount: "ui-accordion:AC/content", label: { kind: "literal", value: "Overview" }, order: 0, z: "f1" },
            { type: "ui-accordion-section", id: "de", mount: "ui-accordion:AC/content", label: { kind: "literal", value: "Details" }, order: 1, z: "f1" },
            { type: "ui-text", id: "ovBody", mount: "ui-accordion-section:ov/content", text: "Overview body", z: "f1" },
            { type: "ui-text", id: "deBody", mount: "ui-accordion-section:de/content", text: "Details body", z: "f1" }
        ]);
    }

    it("renders one sl-details per ui-accordion-section child, content in the panel", () => {
        const result = renderAppPage("P169App", "/", undefined, accordionFlow({ kind: "literal", value: "ov" }));
        expect(result.status).toBe(200);
        expect(result.body).toContain("name=\"ov\"");
        expect(result.body).toContain("name=\"de\"");
        expect(result.body).toContain("summary=\"Overview\"");
        expect(result.body).toContain("summary=\"Details\"");
        expect(result.body).toContain("Overview body");
        expect(result.body).toContain("Details body");
    });

    it("marks the openSection child open; an invalid value falls back to the first child", () => {
        const open = renderAppPage("P169App", "/", undefined, accordionFlow({ kind: "literal", value: "de" }));
        expect(open.body).toContain("name=\"de\" data-webapp-part=\"de\" summary=\"Details\" open");

        const invalid = renderAppPage("P169App", "/", undefined, accordionFlow({ kind: "literal", value: "nope" }));
        // falls back to the first child by order ("ov").
        expect(invalid.body).toContain("name=\"ov\" data-webapp-part=\"ov\" summary=\"Overview\" open");

        const none = renderAppPage("P169App", "/", undefined, accordionFlow());
        expect(none.body).toContain("name=\"ov\" data-webapp-part=\"ov\" summary=\"Overview\" open");
    });

    it("accepts the container:<id>/content mount alias the editor picker emits", () => {
        const defs = build([
            { type: "ui-app", id: "P169Alias", name: "Acc", root: "P169Alias", layout: "app", z: "f1" },
            { type: "ui-accordion", id: "AC2", mount: "P169Alias.content", openSection: { kind: "literal", value: "a" }, z: "f1" },
            { type: "ui-accordion-section", id: "a", mount: "container:AC2/content", label: { kind: "literal", value: "A" }, order: 0, z: "f1" },
            { type: "ui-text", id: "aBody", mount: "container:a/content", text: "A body", z: "f1" }
        ]);
        const result = renderAppPage("P169Alias", "/", undefined, defs);
        expect(result.status).toBe(200);
        expect(result.body).toContain("name=\"a\"");
        expect(result.body).toContain("A body");
    });
});

describe("P169: legacy sections-JSON migration (migrateLegacyAccordionComponents)", () => {
    it("synthesizes ui-accordion-section children and re-points section:<id> content mounts", () => {
        const accDef = runtimeNodeRegistry["ui-accordion"].mapConfig({
            id: "LAC",
            mount: "app.content",
            sections: JSON.stringify([{ id: "x", label: "X" }, { id: "y", label: "Y" }])
        });

        const migrated = migrateLegacyAccordionComponents([
            { ...accDef, id: "LAC" },
            { type: "ui-text", id: "c1", mount: "section:x", text: "X body" }
        ]);

        const accNode = migrated.find((c) => c.type === "ui-accordion");
        expect(accNode?.sections).toBeUndefined();
        expect(accNode?.legacySections).toBeUndefined();

        const sectionChildren = migrated.filter((c) => c.type === "ui-accordion-section");
        expect(sectionChildren).toHaveLength(2);
        expect(sectionChildren.map((s) => s.id).sort()).toEqual(["x", "y"]);
        expect(sectionChildren.find((s) => s.id === "x")?.mount).toBe("ui-accordion:LAC/content");

        const content = migrated.find((c) => c.id === "c1");
        expect(content?.mount).toBe("ui-accordion-section:x/content");
    });

    it("passes a children-model flow through untouched (no legacy carriers)", () => {
        const components = [
            { type: "ui-accordion", id: "NA", mount: "app.content" },
            { type: "ui-accordion-section", id: "s", mount: "ui-accordion:NA/content", label: { kind: "literal", value: "S" } }
        ];
        const migrated = migrateLegacyAccordionComponents(components);
        expect(migrated).toEqual(components);
    });

    it("end-to-end: a legacy sections flow renders the migrated sections + content", () => {
        const defs = build([
            { type: "ui-app", id: "P169Leg", name: "Acc", root: "P169Leg", layout: "app", z: "f1" },
            { type: "ui-accordion", id: "LG", mount: "P169Leg.content", sections: JSON.stringify([{ id: "ov", label: "Overview" }, { id: "de", label: "Details" }]), openSection: { kind: "literal", value: "de" }, z: "f1" },
            { type: "ui-text", id: "lc", mount: "section:ov", text: "Legacy Overview body", z: "f1" }
        ]);
        const result = renderAppPage("P169Leg", "/", undefined, defs);
        expect(result.status).toBe(200);
        expect(result.body).toContain("name=\"de\" data-webapp-part=\"de\" summary=\"Details\" open");
        expect(result.body).toContain("Legacy Overview body");
        expect(result.body).toContain("summary=\"Overview\"");
    });
});

/**
 * P169 (ADR 0018 §1) — uniqueness: two ui-accordion-section children with the same
 * id under one ui-accordion surface a visible deploy error (one issue per
 * offending node). The check groups by the ui-accordion id parsed from each
 * section's mount. Mirror of the ui-tab uniqueness test.
 */
describe("P169: ui-accordion-section id uniqueness (validateUiAccordionSectionChildrenUniqueness)", () => {
    it("reports an issue per node for a duplicate section id within one ui-accordion", () => {
        const RED = fakeRedWithFlow([
            { type: "ui-app", id: "A", root: "A" },
            { type: "ui-accordion", id: "AC", mount: "A.content" },
            { type: "ui-accordion-section", id: "dup", mount: "ui-accordion:AC/content" },
            { type: "ui-accordion-section", id: "dup", mount: "container:AC/content" }
        ]);
        const issues = validateUiAccordionSectionChildrenUniqueness(RED);
        expect(issues).toHaveLength(2);
        expect(issues[0].sectionId).toBe("dup");
        expect(issues[0].host).toBe("AC");
        expect(issues[0].message).toMatch(/Duplicate ui-accordion-section id 'dup'/);
    });

    it("does not flag the same section id under DIFFERENT ui-accordion hosts", () => {
        const RED = fakeRedWithFlow([
            { type: "ui-accordion", id: "AC1", mount: "A.content" },
            { type: "ui-accordion", id: "AC2", mount: "A.content" },
            { type: "ui-accordion-section", id: "same", mount: "ui-accordion:AC1/content" },
            { type: "ui-accordion-section", id: "same", mount: "ui-accordion:AC2/content" }
        ]);
        expect(validateUiAccordionSectionChildrenUniqueness(RED)).toHaveLength(0);
    });

    it("returns no issues for unique section ids", () => {
        const RED = fakeRedWithFlow([
            { type: "ui-accordion", id: "AC", mount: "A.content" },
            { type: "ui-accordion-section", id: "ov", mount: "ui-accordion:AC/content" },
            { type: "ui-accordion-section", id: "de", mount: "ui-accordion:AC/content" }
        ]);
        expect(validateUiAccordionSectionChildrenUniqueness(RED)).toHaveLength(0);
    });
});
