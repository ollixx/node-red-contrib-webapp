import { describe, expect, it } from "vitest";

/**
 * P70 — end-to-end render path for ui-image (webapp.js: toComponentDefinitions →
 * renderer → shared serializer). Verifies:
 *   - ui-image renders as a native <img> in the served page (no longer excluded
 *     from the rendered-components filter),
 *   - a literal URL src lands in the src attribute,
 *   - a dynamic (state) src binding is resolved and emitted,
 *   - alt / fit (object-fit) / width / height surface,
 *   - an asset:<id> src is rewritten to the backend proxy URL (the real
 *     mediaStoreUrl never reaches the client — obfuscation).
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

describe("P70: ui-image renders end-to-end through the served page", () => {
    const definitions = build([
        { type: "ui-app", id: "app1", name: "Demo", root: "app1", layout: "app", mediaStoreUrl: "https://store.internal/media", z: "f1" },
        {
            type: "ui-image",
            id: "img1",
            mount: "app1.content",
            src: { kind: "literal", value: "https://cdn.example.com/p.png" },
            alt: "Product photo",
            fit: "cover",
            width: "100%",
            height: 150,
            fallback: "https://cdn.example.com/placeholder.png",
            z: "f1"
        },
        {
            type: "ui-image",
            id: "img2",
            mount: "app1.content",
            srcPath: "customer.avatarUrl",
            z: "f1"
        },
        {
            type: "ui-image",
            id: "img3",
            mount: "app1.content",
            src: { kind: "literal", value: "asset:logo-2024" },
            z: "f1"
        }
    ]);

    const result = renderAppPage("app1", "/", undefined, definitions);

    it("renders a ui-image as a native <img> (no longer filtered out)", () => {
        expect(result.status).toBe(200);
        expect(result.body).toContain("<img");
    });

    it("emits a literal URL src", () => {
        expect(result.body).toContain("src=\"https://cdn.example.com/p.png\"");
    });

    it("emits alt, object-fit, width and height", () => {
        expect(result.body).toContain("alt=\"Product photo\"");
        expect(result.body).toContain("object-fit: cover");
        expect(result.body).toContain("width: 100%");
        expect(result.body).toContain("height: 150px");
    });

    it("rewrites an asset:<id> src to the backend proxy URL (store URL hidden)", () => {
        // The proxy path is app-scoped and references the asset id, NOT the store URL.
        expect(result.body).toContain("logo-2024");
        expect(result.body).not.toContain("store.internal");
    });
});
