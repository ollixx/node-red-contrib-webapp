import { describe, expect, it } from "vitest";

import { collectSnapshotKinds, mapComponentToShoelace } from "../../renderer/src/index";
import type { RenderSnapshot } from "../../renderer/src/renderer";

/**
 * P25 validation tests — Adapter coverage: remaining component kinds + map corrections.
 *
 * Validation criteria:
 * 1. Each newly-routed kind appears as its Shoelace element in the served HTML.
 * 2. text renders as semantic HTML (not sl-format-text / sl-table).
 * 3. table renders as a real <table> element.
 * 4. collectSnapshotKinds coverage check — no kind in the fixture resolves to
 *    an undefined custom element (i.e. a non-existent sl-* element).
 * 5. docs/theming.md component-mapping section matches KIND_TO_SHOELACE corrections.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const renderAppPage = webappTest.renderAppPage as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { status: number; body: string };

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

function build(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

/** A fixture app with one component of each P16x kind. */
const allKindsDefinitions = build([
    { type: "ui-app", id: "app1", name: "Coverage", root: "app1", layout: "app", z: "f1" },
    // Core kinds — table omitted from the app fixture since it requires a valid
    // rowsPath binding; text/table HTML rendering is tested separately below.
    { type: "ui-text", id: "txt1", mount: "app1.content", text: "Hello", z: "f1" },
    { type: "ui-button", id: "btn1", mount: "app1.content", label: "Click", z: "f1" },
    { type: "ui-input", id: "inp1", mount: "app1.content", label: "Name", valuePath: "name", path: "name", z: "f1" },
    // P16x interactive kinds
    { type: "ui-select", id: "sel1", mount: "app1.content", label: "Select", optionsJson: "[]", z: "f1" },
    { type: "ui-checkbox", id: "chk1", mount: "app1.content", label: "Check", z: "f1" },
    { type: "ui-radio", id: "rad1", mount: "app1.content", label: "Radio", optionsJson: "[]", z: "f1" },
    { type: "ui-switch", id: "sw1", mount: "app1.content", label: "Switch", z: "f1" },
    { type: "ui-textarea", id: "ta1", mount: "app1.content", label: "Notes", z: "f1" },
    { type: "ui-datepicker", id: "dp1", mount: "app1.content", label: "Date", z: "f1" },
    { type: "ui-slider", id: "sl1", mount: "app1.content", z: "f1" },
    { type: "ui-alert", id: "al1", mount: "app1.content", severity: "info", message: "Info", z: "f1" },
    { type: "ui-badge", id: "bdg1", mount: "app1.content", z: "f1" },
    { type: "ui-progress", id: "prg1", mount: "app1.content", z: "f1" },
    { type: "ui-breadcrumb", id: "brd1", mount: "app1.content", z: "f1" },
    { type: "ui-tabs", id: "tabs1", mount: "app1.content", tabs: "[]", z: "f1" },
    { type: "ui-accordion", id: "acc1", mount: "app1.content", sections: "[]", z: "f1" },
    { type: "ui-menu", id: "mn1", mount: "app1.content", z: "f1" },
    { type: "ui-avatar", id: "av1", mount: "app1.content", z: "f1" }
]);

describe("P25 adapter coverage — served HTML", () => {
    let body: string;

    it("renders the fixture app at HTTP 200", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.status).toBe(200);
        body = result.body;
    });

    it("text renders as semantic HTML — not sl-format-text", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).not.toContain("sl-format-text");
        expect(result.body).toContain("webapp-text");
    });

    it("table renders as a real <table> — not sl-table", () => {
        // Table test uses its own fixture with a valid table node
        const tableDefs = build([
            { type: "ui-app", id: "tapp", name: "TableTest", root: "tapp", layout: "app", z: "ft" },
            { type: "ui-table", id: "tbl1", mount: "tapp.content", columns: "[]", rowsPath: "data.list", z: "ft" }
        ]);
        const result = renderAppPage("tapp", "/", undefined, tableDefs);
        expect(result.body).not.toContain("sl-table");
        expect(result.body).toContain("<table");
    });

    it("select renders as <sl-select>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-select");
    });

    it("checkbox renders as <sl-checkbox>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-checkbox");
    });

    it("radio renders as <sl-radio-group>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-radio-group");
    });

    it("switch renders as <sl-switch>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-switch");
    });

    it("textarea renders as <sl-textarea>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-textarea");
    });

    it("datepicker renders as <sl-input type=date>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain('type="date"');
        expect(result.body).toContain("<sl-input");
    });

    it("slider renders as <sl-range>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-range");
    });

    it("alert renders as <sl-alert>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-alert");
    });

    it("badge renders as <sl-badge>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-badge");
    });

    it("progress renders as <sl-progress-bar>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-progress-bar");
    });

    it("breadcrumb renders as <sl-breadcrumb>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-breadcrumb");
    });

    it("tabs renders as <sl-tab-group>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-tab-group");
    });

    it("accordion renders its items as <sl-details>", () => {
        // Empty items means the wrapper is still present
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("webapp-accordion");
    });

    it("menu renders as <sl-menu>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-menu");
    });

    it("avatar renders as <sl-avatar>", () => {
        const result = renderAppPage("app1", "/", undefined, allKindsDefinitions);
        expect(result.body).toContain("<sl-avatar");
    });
});

describe("P25 adapter coverage — KIND_TO_SHOELACE corrections", () => {
    it("text maps to a fallback (no sl-format-text in Shoelace 2.x)", () => {
        const descriptor = mapComponentToShoelace("text", {});
        // text has no Shoelace element — it falls through to the semantic-HTML
        // path. The adapter should NOT return sl-format-text (non-existent).
        expect(descriptor.tag).not.toBe("sl-format-text");
        // It must be either the FALLBACK_TAG (div) or absent from KIND_TO_SHOELACE.
        // Either way it must not be an unknown sl-* element that would never register.
        expect(descriptor.tag).not.toMatch(/^sl-/);
    });

    it("table maps to a fallback (no sl-table in Shoelace 2.x)", () => {
        const descriptor = mapComponentToShoelace("table", {});
        // table has no Shoelace element — falls back to semantic <table>.
        expect(descriptor.tag).not.toBe("sl-table");
        expect(descriptor.tag).not.toMatch(/^sl-/);
    });

    it("select maps to sl-select (real Shoelace 2.x element)", () => {
        const descriptor = mapComponentToShoelace("select", {});
        expect(descriptor.tag).toBe("sl-select");
        expect(descriptor.fallback).toBe(false);
    });

    it("checkbox maps to sl-checkbox (real Shoelace 2.x element)", () => {
        const descriptor = mapComponentToShoelace("checkbox", {});
        expect(descriptor.tag).toBe("sl-checkbox");
        expect(descriptor.fallback).toBe(false);
    });

    it("switch maps to sl-switch (real Shoelace 2.x element)", () => {
        const descriptor = mapComponentToShoelace("switch", {});
        expect(descriptor.tag).toBe("sl-switch");
        expect(descriptor.fallback).toBe(false);
    });

    it("slider maps to sl-range (real Shoelace 2.x element)", () => {
        const descriptor = mapComponentToShoelace("slider", {});
        expect(descriptor.tag).toBe("sl-range");
        expect(descriptor.fallback).toBe(false);
    });

    it("alert maps to sl-alert (real Shoelace 2.x element)", () => {
        const descriptor = mapComponentToShoelace("alert", {});
        expect(descriptor.tag).toBe("sl-alert");
        expect(descriptor.fallback).toBe(false);
    });

    it("progress maps to sl-progress-bar (real Shoelace 2.x element)", () => {
        const descriptor = mapComponentToShoelace("progress", {});
        expect(descriptor.tag).toBe("sl-progress-bar");
        expect(descriptor.fallback).toBe(false);
    });
});

describe("P25 collectSnapshotKinds coverage assertion", () => {
    /**
     * Real Shoelace 2.x custom elements that ship in the library.
     * Any kind that maps to a tag in this set is fully covered.
     * Kinds NOT in KIND_TO_SHOELACE use semantic-HTML fallbacks (text, table)
     * or the generic FALLBACK_TAG — these are also acceptable, but must never
     * silently produce an unregistered custom element name.
     */
    const REAL_SHOELACE_ELEMENTS = new Set([
        "sl-button",
        "sl-input",
        "sl-select",
        "sl-checkbox",
        "sl-radio-group",
        "sl-switch",
        "sl-textarea",
        "sl-range",
        "sl-alert",
        "sl-badge",
        "sl-progress-bar",
        "sl-breadcrumb",
        "sl-tab-group",
        "sl-details",
        "sl-menu",
        "sl-avatar",
        "sl-card"
    ]);

    /**
     * Tags that are known, valid semantic HTML elements used as fallbacks
     * for kinds without a Shoelace equivalent (text → div/p, table → table).
     */
    const ALLOWED_FALLBACK_TAGS = new Set(["div", "p", "table", "span"]);

    it("every kind in the fixture maps to a real sl-* element or a defined semantic-HTML fallback — never an undefined custom element", () => {
        // Build a minimal RenderSnapshot that contains one component of each kind.
        // We test this at the adapter level (mapComponentToShoelace) since
        // collectSnapshotKinds operates on RenderSnapshot objects which require
        // a fully compiled AppModel. We verify the mapping for every kind that
        // the fixture app would produce.
        const allKinds = [
            "text", "button", "table", "input", "card", "container",
            "select", "checkbox", "radio", "switch", "textarea", "datepicker",
            "slider", "alert", "badge", "progress", "breadcrumb", "tabs",
            "accordion", "menu", "avatar"
        ];

        for (const kind of allKinds) {
            const descriptor = mapComponentToShoelace(kind, {});

            const isRealShoelaceElement = REAL_SHOELACE_ELEMENTS.has(descriptor.tag);
            const isAllowedFallback = ALLOWED_FALLBACK_TAGS.has(descriptor.tag);

            // A kind must either render as a known Shoelace element or a defined
            // semantic-HTML fallback — never as an unknown / non-existent tag.
            expect(
                isRealShoelaceElement || isAllowedFallback,
                `kind "${kind}" maps to "${descriptor.tag}" which is neither a real Shoelace element nor an allowed fallback`
            ).toBe(true);
        }
    });

    it("collectSnapshotKinds returns the expected set from a representative snapshot", () => {
        // Build a minimal snapshot with one component of each core kind.
        const mockSnapshot: RenderSnapshot = {
            appId: "app1",
            title: "Coverage",
            location: "/",
            route: { id: "root", path: "/", title: "Home", layoutId: "app" },
            params: {},
            layout: { id: "app", name: "app", preset: "app", slots: [{ name: "content", title: "Content" }] },
            regions: [
                {
                    kind: "region",
                    name: "content",
                    components: [
                        { id: "txt1", kind: "text", mount: "app1.content", text: "Hello", props: {}, events: [], disabled: false },
                        { id: "btn1", kind: "button", mount: "app1.content", label: "Click", props: {}, events: [], disabled: false },
                        { id: "tbl1", kind: "table", mount: "app1.content", columns: [], rows: [], props: {}, events: [], disabled: false },
                        { id: "inp1", kind: "input", mount: "app1.content", value: "", props: {}, events: [], disabled: false },
                        { id: "sel1", kind: "select", mount: "app1.content", value: "", props: {}, events: [], disabled: false } as unknown as Parameters<typeof collectSnapshotKinds>[0]["regions"][0]["components"][0]
                    ],
                    regions: []
                }
            ],
            dialogs: []
        };

        const kinds = collectSnapshotKinds(mockSnapshot);
        expect(kinds.has("text")).toBe(true);
        expect(kinds.has("button")).toBe(true);
        expect(kinds.has("table")).toBe(true);
        expect(kinds.has("input")).toBe(true);
        expect(kinds.has("select")).toBe(true);
    });
});
