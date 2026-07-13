---
id: P215
title: "Test-Infra: shared editor open→save round-trip harness + mandate in node-testing standard (reference/picker/editableList carrier fields)"
epic: aspects/test-infra
status: in_progress
dependencies: [P81]
verify: browser
spec: .ai/agents/node-testing.md
tests: tests/e2e/nodes/state/ui-store-action.tests.md
---
# P215 — Editor open→save round-trip harness + node-testing mandate

> Rationale: [ADR 0031](../../../adr/0031-editor-open-save-round-trip-test-standard.md)
> — the editor open→save clobber bug class (owner 2026-07-13). Foundation package:
> ships the reusable harness and codifies the standard; the tripwire (P216) and
> backfill (P217) build on it.

## findings

The owner's report / decision, in concrete terms (session memory
`state-node-family-and-editor-save-bug-class`, 2026-07-13):

- "Recurring bug class (owner-frustrating): editor open→save clobber.
  Reference/picker/editableList fields get wiped on save because the runtime E2E
  deploys config pre-set and never drives the editor."
- Confirmed hits: `ui-component-instance` `props` (editableList hidden-carrier
  clobber); `ui-store-action`/`ui-store-read` `store` (picker seeded from legacy
  `self.storeId || self.params` instead of `self.store`); `ui-query` `params`.
- "Gap to close: a mandatory open→save round-trip test per reference/picker node
  (owner offered to plan a test-infra standard)."

The bespoke proof already exists at
`tests/e2e/nodes/state/ui-store-action-store-save.spec.ts` (open → assert seeded
→ force dirty → Done → re-read `RED.nodes.node(id).store`). This package
generalises that one spec into a reusable harness and makes it the standard.

## acceptance

Observable, must be proven by the harness running green against real nodes:

- **Harness helper exists and is reusable.** A method
  `assertEditorRoundTrip(nodeId, fields[])` is added to
  `tests/helpers/node-editor-page.ts` (or a sibling helper it re-exports). Each
  `fields[]` entry names a carrier field id (e.g. `"store"`, `"props"`) and its
  expected pre-set value (or a value-change to drive). One call performs the full
  round-trip; specs do not re-implement open/save/re-read.
- **Seeded-on-open assertion.** Given a node deployed with the field pre-set via
  the admin API, the harness opens the editor panel (`openNode`) and fails if the
  hidden `#node-input-<field>` carrier reads **empty** — i.e. it proves
  `oneditprepare` seeded the carrier. (A regression of the store-read/action bug
  makes this red.)
- **Survives Done unchanged.** The harness forces the panel dirty, clicks **Done**
  (`save`), and asserts the persisted `RED.nodes.node(id)[field]` equals the
  pre-set value — not `""`. Removing the seed logic in the node's `oneditprepare`
  turns this red (mutation rule).
- **Value-change round-trips.** The harness drives a **new** value into the
  picker/editableList, saves, reopens, and asserts the new value persists — so the
  test proves round-trip in both directions, not only that the initial value is
  preserved.
- **Two node shapes proven by the harness in this package:** at minimum one
  reference-picker field (`ui-store-action` `store`, replacing the bespoke
  `ui-store-action-store-save.spec.ts` with a harness call) **and** one
  editableList field (`ui-component-instance` `props`). Both pass; the old bespoke
  store-save spec is folded into the harness form (no duplicate).
- **Standard codified.** `.ai/agents/node-testing.md` gains a mandatory subsection
  (e.g. "Editor open→save round-trip (reference/picker/editableList fields)") that:
  states the rule (every hidden-carrier reference/picker/editableList field must
  have a round-trip test via the harness), names the harness entry point, defines
  the qualifying-field shapes (reference picker other than parent/mount;
  editableList), and requires the test be listed in the node's `.tests.md`.
- **Catalogues updated.** The `.tests.md` catalogues of the two nodes exercised
  here (`ui-store-action`, `ui-component`) list the round-trip test with its goal.

## verify

`browser` — the round-trip assertions run through the real Node-RED editor at
:1882 via Playwright (`NodeEditorPage`). Proof = `pnpm exec playwright test` green
with the two harness-based round-trip tests, and each turns **red** when the
node's carrier-seed logic is removed.

## spec

`.ai/agents/node-testing.md` — the durable standard doc that must gain the
open→save round-trip mandate section.

## tests

`tests/e2e/nodes/state/ui-store-action.tests.md` and
`tests/e2e/nodes/view/ui-component.tests.md` — both list the new round-trip test.
The harness itself lives in `tests/helpers/node-editor-page.ts`.

## notes for the implementer

- Do **not** widen scope to the `parent`/`mount` picker — it is already covered by
  `parent-selector.spec.ts` / `editor-mount-options.spec.ts` (ADR 0031). This
  standard targets the *additional* value-carrying reference/picker/editableList
  carriers.
- The existing primitives to build on: `NodeEditorPage.openNode` /
  `.save` / `.readField` / `.readTypedInput` / the `page.evaluate` re-read of
  `RED.nodes.node(id)` used in `ui-store-action-store-save.spec.ts`.
- Fold the bespoke `ui-store-action-store-save.spec.ts` into the harness so there
  is one canonical way, per the `.ai/agents/node-testing.md` "fresh tests" rule.
