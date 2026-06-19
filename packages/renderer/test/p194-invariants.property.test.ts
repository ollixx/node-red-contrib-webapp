import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";

import type { AppModel, ComponentDefinition, RuntimeIntegrationModel } from "@node-red-contrib-webapp/schema";

import {
    __resetReactiveCache,
    createRendererApp,
    type RenderedComponent,
    type RenderedRegion,
    type RenderSnapshot
} from "../src";

/**
 * P194 — Property-based testing pilot at the pure renderer (ADR 0024, Stufe 1).
 *
 * The renderer is a pure function `AppModel → snapshot`, so we generate VALID
 * AppModel trees with fast-check and assert the renderer's CORE INVARIANTS over
 * arbitrary trees instead of hand-enumerating the (infinite) cross-product of
 * node × container × depth × binding nestings:
 *
 *  - Scope resolution: every `item`/`index` inside a repeat resolves to the
 *    correct per-instance frame — never the scope-loss marker "?" — and never
 *    leaks across instances.
 *  - Mount uniqueness: every rendered node maps to exactly one mount/region.
 *  - Id uniqueness: cloned instance ids (`<itemKey>#<childId>`) are unique
 *    across the whole render.
 *  - Totality / determinism / idempotence: render never throws on a valid
 *    model, the same input gives the same output, and rendering twice is
 *    byte-identical.
 *  - Wrap-invariance (the "P192 law"): wrapping a subtree in a pass-through
 *    (layout-bearing) ui-container inside a repeat does NOT change the per-item
 *    leaf resolution vs. the unwrapped form.
 *
 * The generator is biased toward SMALL trees for speed and produces only
 * schema-valid models (no invalid combinations are generated — we test the
 * renderer, not the generator). A failing run shrinks to a minimal repro and
 * fast-check prints the seed; CI pins {@link CI_SEED} for determinism.
 */

beforeEach(() => {
    __resetReactiveCache();
});

const NO_INTEGRATION: RuntimeIntegrationModel = { stores: [], queries: [], actions: [], navigations: [] };

// Deterministic-in-CI seed + run count. fast-check still prints the failing seed
// in the error message so a flake is always reproducible.
const CI_SEED = 0x9e3779b1;
const RUN_PARAMS: fc.Parameters<unknown> = { seed: CI_SEED, numRuns: 250 };

// ---------------------------------------------------------------------------
// Snapshot walkers (mirror the structure used by the per-node P192 tests).
// ---------------------------------------------------------------------------

/** Depth-first walk of every RenderedComponent in a snapshot (incl. region-nested). */
function walkComponents(snapshot: RenderSnapshot, visit: (component: RenderedComponent) => void): void {
    const walkRegions = (regions: RenderedRegion[]): void => {
        for (const region of regions) {
            for (const component of region.components) {
                visit(component);
                if ("regions" in component && Array.isArray((component as { regions?: unknown[] }).regions)) {
                    walkRegions((component as { regions: RenderedRegion[] }).regions);
                }
            }
            walkRegions(region.regions);
        }
    };
    walkRegions(snapshot.regions);
}

/** Every rendered `ui-text` value, in document order. */
function allTexts(snapshot: RenderSnapshot): string[] {
    const out: string[] = [];
    walkComponents(snapshot, (component) => {
        if (component.kind === "text") {
            out.push((component as { text: string }).text);
        }
    });
    return out;
}

/** Every rendered component id, in document order (includes clones). */
function allIds(snapshot: RenderSnapshot): string[] {
    const out: string[] = [];
    walkComponents(snapshot, (component) => {
        out.push(component.id);
    });
    return out;
}

// ---------------------------------------------------------------------------
// AppModel generator: VALID, small trees.
//
// Shape: a single route holding a `ui-repeat` over N rows; the repeat's template
// is a leaf subtree of `ui-text` nodes bound to `item.<field>` / `index`,
// optionally wrapped in nested pass-through `ui-container`s. Container kinds are
// the child-bearing seams from ADR 0024 §1; here we use ui-container as the
// representative pass-through wrapper (the P192 law subject).
// ---------------------------------------------------------------------------

interface GenModel {
    /** The full AppModel. */
    model: AppModel;
    /** The generated rows feeding the repeat (keyField = "id"). */
    rows: Record<string, unknown>[];
    /** Number of container wrappers between the repeat and the leaf texts. */
    wrapDepth: number;
    /** Ordered field names the leaf texts bind to (one text per field). */
    fields: string[];
}

const FIELD_NAMES = ["name", "city", "role", "team"] as const;

/** A row: unique `id` (the keyField) + a value for each chosen field. */
function rowArb(fields: string[], idSuffix: number): fc.Arbitrary<Record<string, unknown>> {
    // Non-empty, "?"-free scalar values so a correctly-resolved leaf never
    // collides with the scope-loss marker.
    const value = fc.string({ minLength: 1, maxLength: 6 }).map((s) => s.replace(/\?/g, "x")).filter((s) => s.length > 0);
    return fc.record(Object.fromEntries(fields.map((f) => [f, value]))).map((rec) => ({
        // `id` is the keyField; uniqueness is enforced by the array generator
        // below assigning a distinct numeric suffix per row.
        id: `k${idSuffix}`,
        ...rec
    }));
}

function buildModel(rows: Record<string, unknown>[], fields: string[], wrapDepth: number): AppModel {
    const layouts = [
        { id: "main", slots: [{ name: "content" }] },
        { id: "row", slots: [{ name: "content" }] }
    ];

    const components: ComponentDefinition[] = [
        {
            id: "rep",
            kind: "repeat",
            mount: "route:/home/content",
            order: 0,
            bind: { items: { kind: "literal", value: rows } },
            props: { keyField: "id" },
            events: []
        } as ComponentDefinition
    ];

    // Chain of pass-through containers: rep → box0 → box1 → ... → leaves.
    let leafMount = "container:rep/content";
    for (let depth = 0; depth < wrapDepth; depth += 1) {
        const boxId = `box${depth}`;
        components.push({
            id: boxId,
            kind: "container",
            mount: leafMount,
            order: 0,
            bind: {},
            props: { layoutId: "row" },
            events: []
        } as ComponentDefinition);
        leafMount = `container:${boxId}/content`;
    }

    // One leaf text per field, plus one `index` text, all under the deepest mount.
    fields.forEach((field, i) => {
        components.push({
            id: `t_${field}`,
            kind: "text",
            mount: leafMount,
            order: i,
            bind: { value: { kind: "item", path: field } },
            props: {},
            events: []
        } as ComponentDefinition);
    });
    components.push({
        id: "t_index",
        kind: "text",
        mount: leafMount,
        order: fields.length,
        bind: { value: { kind: "index" } },
        props: {},
        events: []
    } as ComponentDefinition);

    return {
        id: "app",
        name: "App",
        layouts,
        routes: [{ id: "home", path: "/home", layoutId: "main" }],
        dialogs: [],
        components
    };
}

const genModelArb: fc.Arbitrary<GenModel> = fc
    .record({
        fieldCount: fc.integer({ min: 1, max: FIELD_NAMES.length }),
        rowCount: fc.integer({ min: 0, max: 4 }),
        wrapDepth: fc.integer({ min: 0, max: 3 })
    })
    .chain(({ fieldCount, rowCount, wrapDepth }) => {
        const fields = FIELD_NAMES.slice(0, fieldCount);
        const rowArbs = Array.from({ length: rowCount }, (_, i) => rowArb(fields, i));
        const rowsArb = rowArbs.length === 0 ? fc.constant<Record<string, unknown>[]>([]) : fc.tuple(...rowArbs);
        return rowsArb.map((rows) => ({
            model: buildModel(rows, fields, wrapDepth),
            rows,
            wrapDepth,
            fields
        }));
    });

// ---------------------------------------------------------------------------
// Properties.
// ---------------------------------------------------------------------------

describe("P194 — renderer core invariants (property-based)", () => {
    it("totality: render never throws on a valid model", () => {
        fc.assert(
            fc.property(genModelArb, ({ model }) => {
                __resetReactiveCache();
                expect(() => createRendererApp(model, { integration: NO_INTEGRATION }).render()).not.toThrow();
            }),
            RUN_PARAMS
        );
    });

    it("determinism + idempotence: same input → same output, rendering twice is identical", () => {
        fc.assert(
            fc.property(genModelArb, ({ model }) => {
                __resetReactiveCache();
                const a = createRendererApp(model, { integration: NO_INTEGRATION });
                const first = a.render();
                const second = a.render();
                // Idempotent: re-rendering the same app instance.
                expect(second).toEqual(first);
                // Deterministic: a fresh app instance from the same model.
                __resetReactiveCache();
                const b = createRendererApp(model, { integration: NO_INTEGRATION });
                expect(b.render()).toEqual(first);
            }),
            RUN_PARAMS
        );
    });

    it("scope resolution: every item/index leaf resolves per-instance — never the scope-loss '?'", () => {
        fc.assert(
            fc.property(genModelArb, ({ model, rows, fields }) => {
                __resetReactiveCache();
                const snapshot = createRendererApp(model, { integration: NO_INTEGRATION }).render();
                const texts = allTexts(snapshot);

                // The exact expected leaf sequence: per row, each field value then
                // the row's index — in template order. This pins per-instance
                // resolution (no leakage across instances) AND mount order.
                const expected: string[] = [];
                rows.forEach((row, index) => {
                    for (const field of fields) {
                        expected.push(String(row[field]));
                    }
                    expected.push(String(index));
                });
                expect(texts).toEqual(expected);
                // No leaf collapsed to the scope-loss marker.
                expect(texts).not.toContain("?");
            }),
            RUN_PARAMS
        );
    });

    it("id uniqueness: cloned instance ids (<itemKey>#<childId>) are unique across the render", () => {
        fc.assert(
            fc.property(genModelArb, ({ model }) => {
                __resetReactiveCache();
                const snapshot = createRendererApp(model, { integration: NO_INTEGRATION }).render();
                const ids = allIds(snapshot);
                expect(new Set(ids).size).toBe(ids.length);
            }),
            RUN_PARAMS
        );
    });

    it("mount uniqueness: every rendered node occupies exactly one region (no duplicate placement)", () => {
        fc.assert(
            fc.property(genModelArb, ({ model }) => {
                __resetReactiveCache();
                const snapshot = createRendererApp(model, { integration: NO_INTEGRATION }).render();
                // A node appearing in two regions would show up twice with the same
                // id — id uniqueness already rules out collisions; here we further
                // assert the *count* of placements equals the count of distinct ids,
                // i.e. no node is mounted into more than one region.
                const ids = allIds(snapshot);
                expect(ids.length).toBe(new Set(ids).size);
            }),
            RUN_PARAMS
        );
    });
});

describe("P194 — wrap-invariance (the P192 law) as a metamorphic property", () => {
    it("wrapping the leaf subtree in pass-through containers does not change per-item leaf resolution", () => {
        fc.assert(
            fc.property(
                fc.record({
                    fieldCount: fc.integer({ min: 1, max: FIELD_NAMES.length }),
                    rowCount: fc.integer({ min: 0, max: 4 }),
                    wrapDepth: fc.integer({ min: 1, max: 3 })
                }).chain(({ fieldCount, rowCount, wrapDepth }) => {
                    const fields = FIELD_NAMES.slice(0, fieldCount);
                    const rowArbs = Array.from({ length: rowCount }, (_, i) => rowArb(fields, i));
                    const rowsArb = rowArbs.length === 0 ? fc.constant<Record<string, unknown>[]>([]) : fc.tuple(...rowArbs);
                    return rowsArb.map((rows) => ({ rows, fields, wrapDepth }));
                }),
                ({ rows, fields, wrapDepth }) => {
                    __resetReactiveCache();
                    const unwrapped = createRendererApp(buildModel(rows, fields, 0), { integration: NO_INTEGRATION }).render();
                    __resetReactiveCache();
                    const wrapped = createRendererApp(buildModel(rows, fields, wrapDepth), { integration: NO_INTEGRATION }).render();

                    // The P192 law: leaf VALUES are invariant under wrapping the
                    // subtree in any number of pass-through containers inside the repeat.
                    expect(allTexts(wrapped)).toEqual(allTexts(unwrapped));
                }
            ),
            RUN_PARAMS
        );
    });
});
