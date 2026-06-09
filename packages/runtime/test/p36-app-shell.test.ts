import { describe, expect, it } from "vitest";

/**
 * P36 — App shell: token-themed application chrome for the `app` layout preset
 *
 * The `app` layout renders as a real application chrome (top app bar with
 * brand/title, side navbar, main content, optional footer). Slots carry no
 * bordered-box chrome; structure comes from spacing and a clear type hierarchy.
 * All colors are driven by design tokens (--wa-* custom properties).
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

// ── Base definitions with all four app-layout slots populated ─────────────────

const fullShellDefs = build([
    { type: "ui-app", id: "shellApp", name: "My App", root: "shellApp", layout: "app", z: "f1" },
    { type: "ui-text", id: "hdrText", mount: "shellApp.header", text: "Header content", value: { kind: "literal", value: "Header content" }, z: "f1" },
    { type: "ui-text", id: "navText", mount: "shellApp.navbar", text: "Nav content", value: { kind: "literal", value: "Nav content" }, z: "f1" },
    { type: "ui-text", id: "mainText", mount: "shellApp.content", text: "Main content", value: { kind: "literal", value: "Main content" }, z: "f1" },
    { type: "ui-text", id: "ftrText", mount: "shellApp.footer", text: "Footer content", value: { kind: "literal", value: "Footer content" }, z: "f1" }
]);

// ── Token-themed definitions ──────────────────────────────────────────────────

const themedDefs = build([
    {
        type: "ui-app",
        id: "themedApp",
        name: "Themed",
        title: "Themed",
        root: "themedApp",
        layout: "app",
        z: "f1",
        tokens: { colorPrimary: "#7c3aed" }
    },
    { type: "ui-button", id: "tBtn", mount: "themedApp.content", label: "Go", z: "f1" }
]);

// ── Structural tests ───────────────────────────────────────────────────────────

describe("P36: app layout emits shell structure", () => {
    it("renders with status 200", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.status).toBe(200);
    });

    it("emits the app-bar element with the ui-app title", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.body).toContain("webapp-app-bar");
        expect(result.body).toContain("My App");
    });

    it("emits the header region slot", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.body).toContain("webapp-slot--header");
    });

    it("emits the navbar region slot", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.body).toContain("webapp-slot--navbar");
    });

    it("emits the content region slot", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.body).toContain("webapp-slot--content");
    });

    it("emits the footer region slot", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.body).toContain("webapp-slot--footer");
    });

    it("places components inside their respective slots", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.body).toContain("Header content");
        expect(result.body).toContain("Nav content");
        expect(result.body).toContain("Main content");
        expect(result.body).toContain("Footer content");
    });
});

// ── Token / color tests ────────────────────────────────────────────────────────

describe("P36: app-bar color is driven entirely by design tokens", () => {
    it("emits --wa-color-primary with the token value", () => {
        const result = renderAppPage("themedApp", "/", undefined, themedDefs);
        expect(result.status).toBe(200);
        expect(result.body).toContain("--wa-color-primary: #7c3aed");
    });

    it("app-bar uses the --wa-color-primary custom property (no hard-coded color)", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        // The app-bar background must reference the CSS custom property, not a literal color
        expect(result.body).toContain("--wa-color-primary");
        // The CSS should NOT hard-code any hex or rgb color for the app-bar background
        expect(result.body).not.toMatch(/webapp-app-bar[^}]*background:\s*#[0-9a-fA-F]/);
        expect(result.body).not.toMatch(/webapp-app-bar[^}]*background:\s*rgb\(/);
    });
});

// ── Frameless slot chrome tests ────────────────────────────────────────────────

describe("P36: layout slots carry no bordered-box chrome", () => {
    it("the CSS rule for .webapp-slot does not include border", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        // Old rule: .webapp-slot { border:1px solid var(--wa-color-border); ... }
        // That must be gone — slots must not have a border style
        expect(result.body).not.toMatch(/\.webapp-slot\s*\{[^}]*border:[^}]*\}/);
    });

    it("the CSS rule for .webapp-slot does not include a card background color", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        // Old rule set background:var(--wa-color-surface) on every slot
        expect(result.body).not.toMatch(/\.webapp-slot\s*\{[^}]*background:/);
    });

    it("the CSS rule for .webapp-slot does not include border-radius on the slot wrapper", () => {
        const result = renderAppPage("shellApp", "/", undefined, fullShellDefs);
        expect(result.body).not.toMatch(/\.webapp-slot\s*\{[^}]*border-radius:/);
    });
});
