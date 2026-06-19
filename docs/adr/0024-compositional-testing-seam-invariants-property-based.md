# ADR 0024: testing a compositional node tree — seam invariants + property-based testing, not the cross-product

- Status: accepted
- Date: 2026-06-19
- Builds on: the pure renderer (`AppModel → snapshot`), the per-node `*.tests.md`
  catalogues, [ADR 0022](0022-per-node-review-videos-fixture-driven-showcase.md)
  (review videos / kitchen-sink gallery). Motivated by P190 (editor round-trip)
  and P192 (scope through nested containers) — bugs a property/metamorphic layer
  catches for free.

## Context

The system is a **tree of nodes that nest arbitrarily** (containers, repeats,
tabs, accordions, components) with orthogonal axes (binding kinds, layout presets,
scope levels). The naive test target — every node × container × depth × binding ×
layout combination — is an infinite cross-product. Owner (2026-06-19): how do we
sensibly verify the many features in their combinations and nestings?

## Decision

### 1. Test invariants at the composition SEAMS, not the cross-product

Coverage is **inductive**: if every child-bearing node upholds its seam contract
(propagate scope, resolve mounts, keep ids unique, apply the slot layout), then
**any** nesting works by induction — without enumerating nestings. Seam tests are
**parametrized over the node/container kinds** — O(N), not O(Nᵏ). (P192 is exactly
this: one property "a scope-bound child inside container C resolves the scope",
run over all container kinds.)

### 2. Property-based testing at the pure renderer (the highest-leverage layer)

`AppModel → snapshot` is a pure function — ideal for PBT (`fast-check`). A
**generator of valid node trees** + a few **strong invariants** that must hold for
ANY tree:
- every `item`/`index` inside a repeat resolves (no scope-loss `"?"`);
- every mount resolves to **exactly one** region (no orphan, no collision);
- rendered `data-webapp-node` ids are **unique**;
- render is **total** (never throws), **deterministic**, **idempotent**.
PBT explores the space far beyond hand-written cases and **shrinks** a failure to
a minimal repro.

### 3. Metamorphic relations for the hard features

Relations that hold under transformations, no oracle needed:
- **wrapping a subtree in a pass-through `ui-container` preserves leaf values**
  (= the P192 property, as a law);
- reordering items reorders output but preserves per-item resolution;
- renaming a repeat alias + its references is value-preserving (P193).

### 4. Pairwise for the discrete matrices

Where explicit named cases are wanted (binding-kind × container × layout-preset),
generate the **all-pairs** minimal set (covers most interaction bugs at a fraction
of the cross-product).

### 5. Kitchen-sink gallery = the integration smoke AND the review video

One fixture instantiating every node in representative configs/nestings, rendered
+ snapshotted, and driven as a **showcase** (ADR 0022 / P187): the gallery is both
the visual review and the integration smoke. Visual-regression-style.

### 6. Layered pyramid

The **combinatorics live at the unit/renderer layer** (fast, thousands of
generated cases). **E2E/browser** covers only a curated smoke gallery + concrete
regressions — never the permutations (too slow).

## Consequences

- **P194** (pilot): `fast-check` + a renderer tree-generator + the §2 core
  invariants + the §3 wrap-invariance (the P192 law).
- A cross-cutting **composition** test catalogue (the seam invariants,
  parametrized over container kinds) joins the per-node `*.tests.md`.
- Later, incremental: more invariants, the pairwise matrices, the gallery fixture
  (tied to P187). Not all at once.
- Re-frames the spec/test conversation: "do my nodes uphold their contracts?"
  (finite, inductive) instead of "did I test every combination?" (impossible).
