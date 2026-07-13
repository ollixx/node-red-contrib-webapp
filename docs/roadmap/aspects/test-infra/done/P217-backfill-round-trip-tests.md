---
id: P217
title: "Test-Infra: backfill editor open→save round-trip tests for all remaining reference/picker/editableList nodes — drive the check:roundtrip allowlist to empty"
epic: aspects/test-infra
status: done
dependencies: [P215, P216]
verify: browser
spec: .ai/agents/node-testing.md
tests: tests/e2e/nodes/state/ui-query.tests.md
---
# P217 — Backfill round-trip tests; empty the allowlist

> Rationale: [ADR 0031](../../../../adr/0031-editor-open-save-round-trip-test-standard.md)
> — completes the standard by covering the existing reference/picker/editableList
> nodes. Depends on P215 (harness) and P216 (tripwire that defines the worklist).

## findings

From ADR 0031 and session memory `state-node-family-and-editor-save-bug-class`:

- The open→save clobber has hit `ui-component-instance` `props`,
  `ui-store-action`/`ui-store-read` `store`, and `ui-query` `params` — but any
  node with a value-carrying reference/picker/editableList carrier field is at
  risk, and only P215's two nodes are covered so far.
- P216 lands the tripwire with a **seeded allowlist** of the currently-uncovered
  qualifying nodes so `validate` stays green. That allowlist **is** this
  package's worklist: it enumerates exactly the nodes that still lack a round-trip
  test.

## acceptance

- **Every allowlisted node gets a round-trip test.** For each node in P216's
  `check:roundtrip` allowlist, add an editor open→save round-trip test using the
  P215 harness (`assertEditorRoundTrip`), covering that node's qualifying
  carrier field(s): seeded-on-open, survives Done, and value-change round-trips.
  Known members include `ui-store-read` (`store`), `ui-query` (`params`/`store`)
  and any other reference/editableList carrier the tripwire flagged.
- **Allowlist emptied.** After the backfill, the allowlist in
  `scripts/check-roundtrip.js` is **empty** (or contains only entries with an
  explicit, ADR-justified reason a round-trip test is genuinely N/A — not "not
  written yet"). `pnpm check:roundtrip` passes with no unexplained exemptions.
- **Real regressions caught, not papered over.** If backfilling a node's test
  reveals an actual seed/clobber bug (as with the store nodes), the test is left
  **red** and a bug is raised/fixed — no `renders without crashing` or
  known-bug-accepted comment is added to make it pass (per `node-testing.md`).
- **Catalogues updated.** Each covered node's `tests/e2e/nodes/**/<node>.tests.md`
  lists its round-trip test with the field(s) and test goal.
- **Suite stays lean.** One round-trip test per qualifying node (covering its
  carrier field(s)); no combinatorial explosion (per `node-testing.md` "keep the
  suite from exploding").

## verify

`browser` — the backfilled round-trip tests run through the real editor via
Playwright. Proof = `pnpm exec playwright test` green **and** `pnpm
check:roundtrip` passing with an empty/ADR-justified allowlist.

## spec

`.ai/agents/node-testing.md` — the standard the backfilled tests conform to.

## tests

`tests/e2e/nodes/state/ui-query.tests.md` (and one `.tests.md` per backfilled
node) — each lists its editor open→save round-trip test.

## notes for the implementer

- The worklist is **machine-generated**: read P216's allowlist; do not
  re-enumerate by hand. As each node is covered, remove its allowlist entry and
  re-run `pnpm check:roundtrip` until the allowlist is empty and the tripwire is
  green with no exemptions.
- If the set is large, this may be split into sub-batches by epic/category, but a
  package is only `done` when its portion of the allowlist is emptied and the
  tripwire is green for those nodes.

## Result

**Delivered.** Editor open→save Round-Trip-Tests für ALLE verbliebenen qualifizierenden Carrier-Felder nachgezogen; die `check:roundtrip`-Allowlist ist jetzt **leer** (`{}`) — die ADR-0031-Enforcement hat keine Ausnahmen mehr.
- **4 neue Specs** (je Knoten einer, `assertEditorRoundTrip`, Muster von `ui-store-action.roundtrip.spec.ts`): `tests/e2e/nodes/state/ui-store-read.roundtrip.spec.ts` (`store`), `ui-query-action.roundtrip.spec.ts` (`query`), `ui-query.roundtrip.spec.ts` (`params` + `refreshAction` in einem Aufruf), `tests/e2e/nodes/structure/ui-dialog.roundtrip.spec.ts` (`routeId`).
- **Seed-Korrektheit:** alle 5 Carrier seeden bereits aus dem EIGENEN Feld des Knotens (kein store-artiger Seed-Bug mehr) → keine editor-common/HTML-Korrektur nötig. `ui-store-read.store`←`self.store`; `ui-query.params`←fällt auf `self.params` durch; `ui-query.refreshAction`←`self.refreshAction`; `ui-query-action.query`←`self.query`; `ui-dialog.routeId`←`self.routeId` (clearable, korrekt by construction).
- **Allowlist geleert:** `scripts/check-roundtrip.js` `ALLOWLIST` = `{}` (war 5 Einträge), keine Exemptions.
- **Kataloge:** Round-Trip-Sektion (Marker-Format) an `ui-store-read.tests.md`, `ui-query-action.tests.md`, `ui-query.tests.md` angehängt; `tests/e2e/nodes/structure/ui-dialog.tests.md` neu angelegt (existierte nicht).

**Verify (browser, gemessen — Haupt-Checkout).** Alle **4 Specs 4 passed** (22s): jeder Carrier ist beim Öffnen aus dem Feld geseedet (nicht leer), überlebt Done unverändert, und ein Wertwechsel persistiert + re-seedet beim Wiederöffnen — inkl. der vom Agent zur Prüfung markierten `ui-query` (Fall-through-Seed) und `ui-dialog` (Route-Picker, vorher ohne Katalog). `pnpm check:roundtrip`: **6 Knoten / 7 Felder, 0 allowlisted**.

**Stats.** Unit grün (runtime 1240). `pnpm build`/`lint`/`check:specs`/`check:links`/`check:roadmap` grün. Damit ist die ADR-0031-Trilogie komplett: P215 (Harness + Standard) · P216 (Tripwire) · P217 (Backfill → Allowlist leer).

**Cost.** Sub-Agent `phase/P217` (worktree), ~8 min (19:54Z→20:02Z); Token-Zeile in `.ai/agent-runs.jsonl`.
