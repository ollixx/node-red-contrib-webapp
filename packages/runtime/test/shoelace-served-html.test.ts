import { describe, expect, it } from "vitest";

/**
 * Regression test for the P23 integration gap:
 *
 * P23 loaded Shoelace (CDN + token bridge + adapter module) but the served HTML
 * still emitted the old `webapp-button` / `<input>` markup — only containers
 * were routed through the adapter (sl-card). So the page loaded Shoelace and
 * never used it: buttons and inputs rendered as the old design.
 *
 * Expected: interactive components that DO have a real Shoelace element render
 * as that element in the served HTML — buttons as <sl-button>, inputs as
 * <sl-input>. (Text and tables stay semantic HTML: Shoelace 2.x has no
 * appropriate element for them.)
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

const definitions = build([
    { type: "ui-app", id: "app1", name: "Demo", root: "app1", layout: "app", z: "f1" },
    { type: "ui-button", id: "saveBtn", mount: "app1.content", label: "Save", z: "f1" },
    { type: "ui-input", id: "nameInput", mount: "app1.content", label: "Name", valuePath: "name", path: "name", z: "f1" }
]);

describe("served HTML routes components through the Shoelace adapter", () => {
    it("renders a ui-button as <sl-button>", () => {
        const result = renderAppPage("app1", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("<sl-button");
        // the old hand-rolled button markup must be gone
        expect(result.body).not.toContain('class="webapp-button"');
    });

    it("renders a ui-input as <sl-input>", () => {
        const result = renderAppPage("app1", "/", undefined, definitions);
        expect(result.status).toBe(200);
        expect(result.body).toContain("<sl-input");
    });
});

/**
 * P63 / ADR 0008 — Shoelace is self-hosted (vendored), strictly local, no CDN.
 * The served page must load the theme + autoloader from the local module-resource
 * path and must NOT reference jsdelivr or any external Shoelace origin.
 */
describe("served HTML loads Shoelace strictly from the local resource path", () => {
    const LOCAL_BASE = "/resources/node-red-contrib-webapp/shoelace";

    it("loads the theme stylesheet from the local shoelace path", () => {
        const result = renderAppPage("app1", "/", undefined, definitions);
        expect(result.body).toContain(`href="${LOCAL_BASE}/themes/light.css"`);
    });

    it("loads the autoloader from the local shoelace path", () => {
        const result = renderAppPage("app1", "/", undefined, definitions);
        expect(result.body).toContain(`src="${LOCAL_BASE}/shoelace-autoloader.js"`);
    });

    it("contains NO jsdelivr or external Shoelace URL", () => {
        const result = renderAppPage("app1", "/", undefined, definitions);
        expect(result.body).not.toContain("jsdelivr");
        expect(result.body).not.toContain("cdn.jsdelivr.net");
        // No absolute http(s) reference to a shoelace asset — local path only.
        expect(result.body).not.toMatch(/https?:\/\/[^"']*shoelace/i);
    });
});
