import { describe, expect, it } from "vitest";

/**
 * Regression tests for two rendering bugs:
 *
 * Bug 1 — container:id/slot mounts never matched:
 *   mountMatches() has handlers for route:/path, dialog:, layout: but NOT container:.
 *   Children placed inside a container via "container:nodeId/slot" were silently dropped.
 *
 * Bug 2 — slot names shown as visible h2 headings:
 *   renderSlotHtml() always emits <header><h2>{slot.name}</h2></header>.
 *   Internal slot names (header, navbar, content, footer) should never be user-visible.
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

function buildDefinitions(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig
            ? { ...reg.mapConfig(node), z: node.z }
            : { ...node, id: node.id };
    });
}

const rawNodes = [
    { type: "ui-app",       id: "testapp",    name: "Test App",      root: "testapp", layout: "app",      z: "flow1" },
    { type: "ui-container", id: "container1", name: "My Container",  mount: "testapp.content", layoutId: "vertical", z: "flow1" },
    { type: "ui-text",      id: "text1",      name: "Hello Text",    mount: "container:container1/content", value: { kind: "literal", value: "Hello world" }, z: "flow1" }
];

const definitions = buildDefinitions(rawNodes);

describe("rendering: container:id/slot children", () => {
    it("renders a ui-text inside a container when mount uses container:id/slot format", () => {
        const result = renderAppPage("testapp", "/", undefined, definitions);

        expect(result.status).toBe(200);
        expect(result.body).toContain("Hello world");
    });
});

describe("rendering: slot names must not appear as visible headings", () => {
    it("does not render slot names (header, navbar, content, footer) as h2 headings", () => {
        const result = renderAppPage("testapp", "/", undefined, definitions);

        expect(result.status).toBe(200);
        expect(result.body).not.toMatch(/<h2[^>]*>\s*header\s*<\/h2>/i);
        expect(result.body).not.toMatch(/<h2[^>]*>\s*navbar\s*<\/h2>/i);
        expect(result.body).not.toMatch(/<h2[^>]*>\s*content\s*<\/h2>/i);
        expect(result.body).not.toMatch(/<h2[^>]*>\s*footer\s*<\/h2>/i);
    });
});
