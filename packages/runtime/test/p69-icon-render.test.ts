import { describe, expect, it } from "vitest";

/**
 * P69 — end-to-end render path for icons (webapp.js: toComponentDefinitions →
 * renderer → shared serializer). Verifies:
 *   - ui-icon renders as <sl-icon> in the served page (P77 coordination: ui-icon
 *     is no longer excluded from the rendered components filter),
 *   - a backend-neutral { library, name } / "library:name" value surfaces the
 *     library attribute,
 *   - ui-button renders a prefix <sl-icon>,
 *   - ui-avatar renders an icon fallback when no src/initials.
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
    { type: "ui-icon", id: "icon1", mount: "app1.content", icon: "house", z: "f1" },
    { type: "ui-icon", id: "icon2", mount: "app1.content", icon: "lucide:star", z: "f1" },
    { type: "ui-button", id: "btn1", mount: "app1.content", label: "Add", icon: "plus", z: "f1" },
    { type: "ui-avatar", id: "av1", mount: "app1.content", icon: "person", z: "f1" }
]);

describe("P69: icons render end-to-end through the served page", () => {
    const result = renderAppPage("app1", "/", undefined, definitions);

    it("renders a ui-icon as <sl-icon> (no longer filtered out)", () => {
        expect(result.status).toBe(200);
        expect(result.body).toContain("<sl-icon");
        expect(result.body).toContain("name=\"house\"");
    });

    it("surfaces an explicit library as the library attribute", () => {
        expect(result.body).toContain("name=\"star\"");
        expect(result.body).toContain("library=\"lucide\"");
    });

    it("renders a button prefix icon", () => {
        expect(result.body).toContain("slot=\"prefix\"");
        expect(result.body).toContain("name=\"plus\"");
    });

    it("renders an avatar icon fallback", () => {
        expect(result.body).toContain("<sl-avatar");
        expect(result.body).toContain("name=\"person\"");
    });
});
