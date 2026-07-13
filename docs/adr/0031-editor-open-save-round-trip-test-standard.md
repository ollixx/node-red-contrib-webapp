# ADR 0031: editor open→save round-trip is a mandatory test standard for reference/picker/editableList fields

- Status: accepted
- Date: 2026-07-13
- Builds on: [ADR 0028](0028-store-reads-are-a-separate-reference-node.md) and
  [ADR 0029](0029-state-action-nodes-store-action-query-action-hybrid.md) (the
  reference-based state nodes whose `store`/`query` pickers exposed this bug
  class), and the node-testing standard `.ai/agents/node-testing.md`.

## Context

A recurring, owner-frustrating bug class keeps shipping undetected: **the editor
open→save clobber.** A node's reference/picker/editableList field holds a value
in a hidden `#node-input-<field>` carrier. The node's `oneditprepare` must *seed*
that carrier from the saved config on open; if it does not, Node-RED's automatic
field-copy on **Done** writes the (empty) carrier back over the real property and
the value is silently lost on the first edit of the node.

Confirmed hits so far:

- **`ui-component-instance` `props`** — the `editableList` value was not copied
  into its hidden carrier, so saving wiped the props.
- **`ui-store-action` / `ui-store-read` `store`** — `installReferenceSelectors`'
  store branch seeded the picker from the legacy `self.storeId || self.params`
  (the `ui-query` field names) instead of this node's `self.store`, so open→Done
  clobbered the store reference (fixed 2026-07-13).
- **`ui-query` `params`** — same shape (P214 area).

Every one of these passed the existing suite. **Root cause of the blind spot:**
the runtime/behaviour specs deploy the node with its config **pre-set via the
admin API and never drive the editor** — they exercise the runtime path, not the
editor open→save path where the clobber happens. So the field is correct at
deploy time and the regression is invisible until a human opens the node in the
editor, saves, and loses their reference.

The editor-driving primitives to catch this already exist
(`tests/helpers/node-editor-page.ts`: `openNode` → `save` (Done) → re-read the
persisted `RED.nodes.node(id)`), and one bespoke spec
(`ui-store-action-store-save.spec.ts`) proves the pattern. What is missing is a
**standard**: the check is done ad hoc, per bug, after the owner hits it — there
is no rule that every reference/picker/editableList field must round-trip through
the editor, and nothing fails when a new such field ships without that test.

Owner (2026-07-13, recorded in session memory
`state-node-family-and-editor-save-bug-class`): the gap to close is *"a mandatory
open→save round-trip test per reference/picker node"* — and the owner offered to
plan it as a **test-infra standard**.

## Decision

Adopt an **editor open→save round-trip test standard**, enforced by a tripwire,
covering every `ui-*` node field that persists through a **hidden carrier** — the
three shapes that have produced the clobber:

1. **reference pickers** — `installReferenceSelectors` fields that serialize a
   selected node id into `#node-input-<field>` (e.g. `store`, `query`), **other
   than** the ubiquitous `parent`/`mount` picker, which is already covered by
   `parent-selector.spec.ts` / `editor-mount-options.spec.ts`;
2. **editableList fields** — e.g. `ui-component-instance` `props`;
3. any future field of the same carrier shape.

The standard has three parts:

- **A shared harness (contract).** A reusable helper — an
  `assertEditorRoundTrip(nodeId, fields)` on top of `NodeEditorPage` — that, for
  a node deployed with the field pre-set: (a) opens the editor panel and asserts
  each carrier field is **seeded non-empty on open** (proves `oneditprepare`
  seeded it); (b) forces the panel dirty and clicks **Done**; (c) re-reads the
  persisted `RED.nodes.node(id)` and asserts every field **survived unchanged**;
  and (d) drives a **value change** through the picker/list and confirms the new
  value persists on the next open. One call per node, not re-derived per bug.

- **A mandate in the node-testing standard.** `.ai/agents/node-testing.md` gains
  a mandatory section: any node phase that adds or changes a
  reference/picker/editableList carrier field **must** include the open→save
  round-trip test (via the harness) and list it in the node's `.tests.md`
  catalogue. A "renders / deploys correctly" test does not satisfy it.

- **A tripwire (enforcement).** A read-only `pnpm check:roundtrip`, wired into
  `pnpm validate`, enumerates every node whose editor HTML declares a
  qualifying carrier field and **fails** if that node has no round-trip test
  registered in its `.tests.md`. A small curated **allowlist** (same idiom as
  `check-specs.js`) carries the currently-unconverted nodes so `validate` stays
  green; the allowlist is driven to **empty** by the backfill, after which every
  reference/picker/editableList node is provably covered and future ones cannot
  ship uncovered.

## Consequences

- **The clobber bug class becomes non-regressing.** A new reference/picker/
  editableList field that fails to seed its carrier now turns a test **red**
  before merge, instead of surfacing when the owner loses a reference in the
  editor.
- **"Mandatory" is enforced, not aspirational.** The tripwire makes the standard
  mechanical; the allowlist keeps `validate` green during rollout and shrinks to
  zero, so the exemption surface is visible and finite.
- **One harness, many nodes.** Per-node round-trip tests are one helper call, so
  the cost of the standard is low and the tests read uniformly.
- **Scope is deliberately narrow.** The standard targets the hidden-carrier
  shape that actually clobbers (reference picker / editableList), **not** every
  editor field and **not** the parent/mount picker already covered elsewhere —
  avoiding a combinatorial test explosion (the "keep the suite from exploding"
  rule in `node-testing.md`).
- **Three test-infra packages** implement it: the harness + standard (foundation),
  the tripwire + seeded allowlist (enforcement), and the backfill that empties the
  allowlist. No `ui-*` runtime behaviour changes.
