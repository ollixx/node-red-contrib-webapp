import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
    };
};

const { runtimeNodeRegistry, renderAppPage } = webapp.__test__;

function build(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig
            ? { ...reg.mapConfig(node), z: node.z, id: node.id, uiId: node.id }
            : { ...node };
    });
}

/**
 * P170 (ADR 0017 × 0018, capstone) — DYNAMIC tabs/sections via ui-repeat, proven
 * through the FULL pipeline (node configs → registry → AppModel → rendered HTML).
 *
 * A `ui-repeat` (template = one `ui-tab`, `label = item.<field>`) mounted into a
 * `ui-tabs` renders one tab per data row; same for `ui-accordion` +
 * `ui-accordion-section`. No bespoke dynamic-slot mechanism — pure composition of
 * the ui-repeat clone (ADR 0017) and children-define-sections (ADR 0018). This is
 * the non-browser render proof (the path P168/P169 used); the orchestrator runs
 * the authoritative browser E2E.
 *
 * `items` is a literal array here so the render proof needs no live store; the
 * reactive store path (add/remove/reorder) is covered by the renderer-level
 * keyed-stability suite (`packages/renderer/.../p170-dynamic-tabs-sections`).
 */

const ROWS = [
    { id: "a", name: "Ada", bio: "Analyst" },
    { id: "l", name: "Linus", bio: "Kernel" },
    { id: "g", name: "Grace", bio: "Compiler" }
];

describe("P170: dynamic ui-tabs via ui-repeat-of-ui-tab — rendered HTML", () => {
    function dynamicTabsFlow() {
        return build([
            { type: "ui-app", id: "P170Tabs", name: "Tabs", root: "P170Tabs", layout: "app", z: "f1" },
            { type: "ui-tabs", id: "TB", mount: "P170Tabs.content", z: "f1" },
            { type: "ui-repeat", id: "REP", mount: "ui-tabs:TB/content", items: { kind: "literal", value: ROWS }, keyField: "id", z: "f1" },
            { type: "ui-tab", id: "tpl", mount: "container:REP/content", label: { kind: "item", path: "name" }, order: 0, z: "f1" },
            { type: "ui-text", id: "body", mount: "ui-tab:tpl/content", value: { kind: "item", path: "bio" }, z: "f1" }
        ]);
    }

    it("renders one sl-tab + panel per row, label/body from item.<field>", () => {
        const result = renderAppPage("P170Tabs", "/", undefined, dynamicTabsFlow());
        expect(result.status).toBe(200);

        // one keyed tab per row (id = <itemKey>#<templateId>).
        expect(result.body).toContain("panel=\"a#tpl\"");
        expect(result.body).toContain("panel=\"l#tpl\"");
        expect(result.body).toContain("panel=\"g#tpl\"");

        // tab labels come from item.name.
        expect(result.body).toContain(">Ada</sl-tab>");
        expect(result.body).toContain(">Linus</sl-tab>");
        expect(result.body).toContain(">Grace</sl-tab>");

        // each panel's body resolved against its row scope (item.bio).
        expect(result.body).toContain("Analyst");
        expect(result.body).toContain("Kernel");
        expect(result.body).toContain("Compiler");

        // default active = first dynamic tab.
        expect(result.body).toContain("panel=\"a#tpl\" data-webapp-part=\"a#tpl\" active");
    });
});

describe("P170: dynamic ui-accordion via ui-repeat-of-ui-accordion-section — rendered HTML", () => {
    function dynamicAccordionFlow() {
        return build([
            { type: "ui-app", id: "P170Acc", name: "Acc", root: "P170Acc", layout: "app", z: "f1" },
            { type: "ui-accordion", id: "AC", mount: "P170Acc.content", z: "f1" },
            { type: "ui-repeat", id: "REP", mount: "ui-accordion:AC/content", items: { kind: "literal", value: ROWS }, keyField: "id", z: "f1" },
            { type: "ui-accordion-section", id: "tpl", mount: "container:REP/content", label: { kind: "item", path: "name" }, order: 0, z: "f1" },
            { type: "ui-text", id: "body", mount: "ui-accordion-section:tpl/content", value: { kind: "item", path: "bio" }, z: "f1" }
        ]);
    }

    it("renders one sl-details per row, summary/body from item.<field>", () => {
        const result = renderAppPage("P170Acc", "/", undefined, dynamicAccordionFlow());
        expect(result.status).toBe(200);

        expect(result.body).toContain("name=\"a#tpl\"");
        expect(result.body).toContain("name=\"l#tpl\"");
        expect(result.body).toContain("name=\"g#tpl\"");

        expect(result.body).toContain("summary=\"Ada\"");
        expect(result.body).toContain("summary=\"Linus\"");
        expect(result.body).toContain("summary=\"Grace\"");

        expect(result.body).toContain("Analyst");
        expect(result.body).toContain("Kernel");
        expect(result.body).toContain("Compiler");

        // default open = first dynamic section.
        expect(result.body).toContain("name=\"a#tpl\" data-webapp-part=\"a#tpl\" summary=\"Ada\" open");
    });
});
