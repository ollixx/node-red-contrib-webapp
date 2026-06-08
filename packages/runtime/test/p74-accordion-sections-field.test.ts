/**
 * P74 — Bugfix: ui-accordion field name mismatch.
 *
 * The schema declares `sections` (accordionSectionSchema), but the editor
 * HTML registered `items` and mapConfig in webapp.js read `config.items` and
 * emitted `items`. After this fix both the mapConfig output and the editor
 * use `sections`.
 *
 * Tests verify:
 *   1. mapConfig with `sections` input outputs `sections` (not `items`).
 *   2. buildAppSnapshot succeeds when `sections` is provided and sections
 *      field reaches the compiled component props.
 *   3. validateUiNodeDefinition fails when the old `items` field is used
 *      (the schema requires `sections`).
 *   4. validateUiNodeDefinition passes when `sections` is provided.
 */

import { describe, expect, it } from "vitest";
import { validateUiNodeDefinition } from "@node-red-contrib-webapp/schema";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const runtimeNodeRegistry = webappTest.runtimeNodeRegistry as Record<
    string,
    { mapConfig: (config: Record<string, unknown>) => Record<string, unknown> }
>;

const buildAppSnapshot = webappTest.buildAppSnapshot as (
    appId: string,
    location: string,
    dialogId: string | undefined,
    definitions: unknown[]
) => { success: boolean; snapshot?: { regions: { components: unknown[] }[] }; error?: unknown };

function buildDefs(nodes: Record<string, unknown>[]) {
    return nodes.map((n) => {
        const reg = runtimeNodeRegistry[n.type as string];
        return reg?.mapConfig ? { ...reg.mapConfig(n), z: n.z } : { ...n, id: n.id };
    });
}

const SECTIONS = [
    { id: "s1", label: "Section 1" },
    { id: "s2", label: "Section 2" },
];

describe("P74 — ui-accordion: mapConfig outputs `sections`, not `items`", () => {
    it("mapConfig maps the `sections` config field to `sections` in the output", () => {
        const reg = runtimeNodeRegistry["ui-accordion"];
        expect(reg).toBeDefined();

        const out = reg.mapConfig({
            id: "acc74",
            type: "ui-accordion",
            mount: "app74.content",
            sections: JSON.stringify(SECTIONS),
        });

        expect(out).toHaveProperty("sections");
        expect((out as { sections: unknown }).sections).toEqual(SECTIONS);
        // must NOT have an `items` field
        expect(out).not.toHaveProperty("items");
    });

    it("buildAppSnapshot succeeds when `sections` is provided and sections reach component.props", () => {
        const defs = buildDefs([
            { type: "ui-app", id: "app74", name: "App", root: "app74", layout: "app", z: "f1" },
            {
                type: "ui-accordion",
                id: "acc74",
                mount: "app74.content",
                sections: JSON.stringify(SECTIONS),
                z: "f1",
            },
        ]);

        const result = buildAppSnapshot("app74", "/", undefined, defs);
        expect(result.success).toBe(true);

        const components = result.snapshot!.regions.flatMap((r) => r.components);
        const acc = components.find(
            (c) => (c as { id: string }).id === "acc74"
        ) as { props: Record<string, unknown> } | undefined;
        expect(acc).toBeDefined();
        // sections must be in props
        expect(acc!.props.sections).toEqual(SECTIONS);
    });

    it("validateUiNodeDefinition fails when old `items` field is used (schema requires `sections`)", () => {
        const result = validateUiNodeDefinition({
            type: "ui-accordion",
            id: "acc74b",
            mount: "app74b.content",
            // deliberately use the old `items` field — should fail schema validation
            items: SECTIONS,
        });
        expect(result.success).toBe(false);
    });

    it("validateUiNodeDefinition passes when `sections` is provided", () => {
        const result = validateUiNodeDefinition({
            type: "ui-accordion",
            id: "acc74c",
            mount: "app74c.content",
            sections: SECTIONS,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((result.data as any).sections).toEqual(SECTIONS);
        }
    });
});
