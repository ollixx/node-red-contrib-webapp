import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const webapp = require("../../../nodes/webapp.js") as {
    __test__: {
        runtimeNodeRegistry: Record<string, { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }>;
        renderAppPage: (appId: string, location: string, dialogId: string | undefined, definitions: unknown[]) => { status: number; body: string };
        getAppModelResult: (
            appId: string,
            definitions: unknown[]
        ) => { success: boolean; model?: { components: Array<{ id: string; kind: string; props: Record<string, unknown> }> } };
    };
};

const { runtimeNodeRegistry, renderAppPage, getAppModelResult } = webapp.__test__;

// Build raw flow nodes through each type's mapConfig (mirroring the deploy path),
// keeping z / id so getAppModelResult buckets them into the app. This is the SAME
// path the E2E fixture takes through Node-RED — NOT a hand-built AppModel. The
// renderer-only P192 unit test (packages/renderer/test/p192-…) skips this compile
// step and so missed the field-name bug below.
function build(rawNodes: Record<string, unknown>[]): Record<string, unknown>[] {
    return rawNodes.map((node) => {
        const reg = runtimeNodeRegistry[node.type as string];
        return reg?.mapConfig
            ? { ...reg.mapConfig(node), z: node.z, id: node.id, uiId: node.id }
            : { ...node };
    });
}

/** All rendered `<p class="webapp-text …">` bodies in mount order. */
function renderedTexts(body: string): string[] {
    const out: string[] = [];
    const re = /<p class="webapp-text[^"]*"[^>]*>([^<]*)<\/p>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(body)) !== null) {
        out.push(match[1]);
    }
    return out;
}

/**
 * P192 (FIX, Owner 2026-06-19) — item-scope through a child-bearing container
 * inside a ui-repeat, exercised END-TO-END through the runtime compile +
 * renderAppPage (the deploy path), not a hand-built AppModel.
 *
 * Repro: a `ui-container` (layout preset `horizontal`) inside a `ui-repeat` over
 * a two-row store, holding two `ui-text` bound to `item.name` / `item.city`. This
 * is the exact shape of `tests/e2e/fixtures/ui-repeat-container.flow.json`.
 *
 * The orchestrator's authoritative E2E found this rendered ZERO `.webapp-text`
 * elements. Root cause: the runtime compile mapped the container's `layoutId`
 * field, but the E2E fixture (and any flow) carries the editor's field name —
 * the `ui-container` mapConfig reads `config.layoutId`. A container with no
 * resolved `layoutId` produces NO regions in the renderer (the `container` case
 * returns `undefined`), so its child subtree never reaches a region and nothing
 * renders — not even a `"?"` fallback. The renderer-only unit test passed because
 * it hand-built the AppModel with `props.layoutId` already set, bypassing the
 * mapConfig field-name mismatch.
 *
 * This test reproduces the real 0-elements failure (it asserts on the compiled
 * model's container `layoutId` AND the rendered per-row text) so the bug cannot
 * silently come back via the compile step.
 */
describe("P192 (integration): item-scope through a container inside a repeat — real compile + render", () => {
    function containerInRepeatFlow() {
        return build([
            { type: "ui-app", id: "P192App", name: "Repeat Container App", root: "P192App", layout: "app", z: "f1" },
            {
                type: "ui-store", id: "rowsStore", name: "Rows", parent: "P192App", statePath: "rows",
                initialValue: JSON.stringify([{ name: "Ada", city: "London" }, { name: "Linus", city: "Helsinki" }]),
                z: "f1"
            },
            {
                type: "ui-repeat", id: "rowsRepeat", parent: "P192App", mount: "P192App.content", order: 0,
                items: { kind: "store", path: "rowsStore" }, keyField: "name", z: "f1"
            },
            // The editor's real field name is `layoutId` (the HTML uses
            // #node-input-layoutId). A flow that uses any other key leaves the
            // container layout-less → no regions → 0 children render.
            {
                type: "ui-container", id: "rowBox", parent: "rowsRepeat",
                mount: "container:rowsRepeat/content", order: 0, layoutId: "horizontal", z: "f1"
            },
            {
                type: "ui-text", id: "rowName", parent: "rowBox", mount: "container:rowBox/content", order: 0,
                value: { kind: "item", path: "name" }, z: "f1"
            },
            {
                type: "ui-text", id: "rowCity", parent: "rowBox", mount: "container:rowBox/content", order: 1,
                value: { kind: "item", path: "city" }, z: "f1"
            }
        ]);
    }

    it("the compiled container carries a resolved layoutId (the regression guard)", () => {
        const result = getAppModelResult("P192App", containerInRepeatFlow());
        expect(result.success).toBe(true);
        const container = result.model?.components.find((component) => component.id === "rowBox");
        expect(container?.kind).toBe("container");
        // The bug: container.props.layoutId === undefined → renderer drops the
        // whole subtree. The fix keeps it resolved through the compile step.
        expect(container?.props.layoutId).toBe("horizontal");
    });

    it("renders the container's children per row through the deploy pipeline (no 0-elements)", () => {
        const result = renderAppPage("P192App", "/", undefined, containerInRepeatFlow());
        expect(result.status).toBe(200);

        const body = result.body.slice(result.body.indexOf("<body"));
        // The authoritative E2E asserts exactly this set on `.webapp-text`.
        expect(renderedTexts(body)).toEqual(["Ada", "London", "Linus", "Helsinki"]);
    });

    it("the cloned container's children carry the per-instance id prefix", () => {
        const result = renderAppPage("P192App", "/", undefined, containerInRepeatFlow());
        const body = result.body.slice(result.body.indexOf("<body"));

        // keyField = name → itemKey = Ada/Linus; children resolve INSIDE the clone
        // (id <itemKey>#<childId>), never back to the original node.
        for (const id of ["Ada#rowBox", "Ada#rowName", "Ada#rowCity", "Linus#rowBox", "Linus#rowName", "Linus#rowCity"]) {
            expect(body).toContain(`data-webapp-node="${id}"`);
        }
        // The ORIGINAL (un-cloned) child ids must NOT appear.
        expect(body).not.toContain('data-webapp-node="rowName"');
        expect(body).not.toContain('data-webapp-node="rowCity"');
    });
});
