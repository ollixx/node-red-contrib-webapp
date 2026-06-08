import { describe, expect, it } from "vitest";

/**
 * P70 Ebene 3 — media-store backend proxy resolution. The client only ever sees
 * /webapp/<appId>/asset/<id>; resolveAssetStoreUrl maps that to the real upstream
 * URL using the app's mediaStoreUrl config (which never reaches the client). The
 * asset id is charset-validated so it cannot traverse out of the store base path.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

const resolveAssetStoreUrl = webappTest.resolveAssetStoreUrl as (
    appId: string,
    id: string,
    definitions: unknown[]
) => { ok: boolean; status?: number; url?: string; error?: string };

function build(rawNodes: Record<string, unknown>[]) {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(node), z: node.z } : { ...node, id: node.id };
    });
}

const defsWithStore = build([
    { type: "ui-app", id: "app1", name: "Demo", root: "app1", layout: "app", mediaStoreUrl: "https://store.internal/media/", z: "f1" }
]);

const defsNoStore = build([
    { type: "ui-app", id: "app2", name: "Demo2", root: "app2", layout: "app", z: "f2" }
]);

describe("P70: resolveAssetStoreUrl (media-store proxy resolution)", () => {
    it("resolves a valid asset id against the configured store URL", () => {
        const r = resolveAssetStoreUrl("app1", "logo-2024", defsWithStore);
        expect(r.ok).toBe(true);
        expect(r.url).toBe("https://store.internal/media/logo-2024");
    });

    it("normalises a trailing slash on the store URL (no double slash)", () => {
        const r = resolveAssetStoreUrl("app1", "a.png", defsWithStore);
        expect(r.url).toBe("https://store.internal/media/a.png");
    });

    it("rejects a path-traversal id", () => {
        for (const bad of ["..", "../secret", "a/b", "a%2Fb", "/etc/passwd", "."]) {
            const r = resolveAssetStoreUrl("app1", bad, defsWithStore);
            expect(r.ok, bad).toBe(false);
            expect(r.status, bad).toBe(400);
        }
    });

    it("returns 404 when the app has no media store configured", () => {
        const r = resolveAssetStoreUrl("app2", "logo", defsNoStore);
        expect(r.ok).toBe(false);
        expect(r.status).toBe(404);
    });

    it("returns 404 for an unknown app", () => {
        const r = resolveAssetStoreUrl("nope", "logo", defsWithStore);
        expect(r.ok).toBe(false);
        expect(r.status).toBe(404);
    });
});
