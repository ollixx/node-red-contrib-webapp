import { describe, expect, it } from "vitest";

/**
 * P24 — Page shell and theme: Shoelace + design tokens
 *
 * The old bespoke page shell (beige/serif theme, --bg:#f4f1e8, Georgia,
 * .webapp-shell, .webapp-topbar "Runtime Preview") must be removed and replaced
 * by a token-driven shell that delegates colours and typography to the
 * --wa-* custom properties (already bridged to Shoelace --sl-* vars in P23).
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

const baseDefinitions = build([
    { type: "ui-app", id: "app1", name: "Demo App", root: "app1", layout: "app", z: "f1" },
    { type: "ui-button", id: "btn1", mount: "app1.content", label: "Click me", z: "f1" }
]);

const tokenDefinitions = build([
    {
        type: "ui-app",
        id: "app2",
        name: "Themed App",
        root: "app2",
        layout: "app",
        z: "f1",
        tokens: { colorPrimary: "#e11d48" }
    },
    { type: "ui-button", id: "btn2", mount: "app2.content", label: "Go", z: "f1" }
]);

describe("P24: served HTML no longer contains old bespoke theme markers", () => {
    it("does not contain the Georgia font reference", () => {
        const result = renderAppPage("app1", "/", undefined, baseDefinitions);
        expect(result.status).toBe(200);
        expect(result.body).not.toContain("Georgia");
    });

    it("does not contain the beige background token --bg:#f4f1e8", () => {
        const result = renderAppPage("app1", "/", undefined, baseDefinitions);
        expect(result.body).not.toContain("--bg:#f4f1e8");
    });

    it("does not contain the 'Runtime Preview' topbar text", () => {
        const result = renderAppPage("app1", "/", undefined, baseDefinitions);
        expect(result.body).not.toContain("Runtime Preview");
    });

    it("does not contain the .webapp-shell class", () => {
        const result = renderAppPage("app1", "/", undefined, baseDefinitions);
        expect(result.body).not.toContain("webapp-shell");
    });
});

describe("P24: design tokens from ui-app drive CSS custom properties", () => {
    it("emits --wa-color-primary with the token value when colorPrimary is set", () => {
        const result = renderAppPage("app2", "/", undefined, tokenDefinitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("--wa-color-primary: #e11d48");
    });
});

describe("P24: layout regions still render and mount components", () => {
    it("renders a header slot section", () => {
        const defs = build([
            { type: "ui-app", id: "app3", name: "App3", root: "app3", layout: "app", z: "f1" },
            { type: "ui-button", id: "hdrBtn", mount: "app3.header", label: "Top", z: "f1" }
        ]);
        const result = renderAppPage("app3", "/", undefined, defs);
        expect(result.status).toBe(200);
        expect(result.body).toContain("webapp-slot--header");
    });

    it("renders a navbar slot section", () => {
        const defs = build([
            { type: "ui-app", id: "app4", name: "App4", root: "app4", layout: "app", z: "f1" },
            { type: "ui-button", id: "navBtn", mount: "app4.navbar", label: "Nav", z: "f1" }
        ]);
        const result = renderAppPage("app4", "/", undefined, defs);
        expect(result.status).toBe(200);
        expect(result.body).toContain("webapp-slot--navbar");
    });

    it("renders a content slot section", () => {
        const result = renderAppPage("app1", "/", undefined, baseDefinitions);
        expect(result.body).toContain("webapp-slot--content");
    });

    it("mounts components inside the content slot", () => {
        const result = renderAppPage("app1", "/", undefined, baseDefinitions);
        // The button should appear in the body
        expect(result.body).toContain("<sl-button");
    });
});
