---
id: P154
node: ui-pagination
epic: nodes/ui-pagination
title: "ui-pagination: totalPath→value (lesend), currentPagePath→value (zweiseitig + Change-Event)"
findings:
  - "Field-Typing-Audit (2026-06-11): totalPath/currentPagePath sind nackte Textfelder. currentPage ist zweiseitig (Binding + Change-Event), wie ein Input-value."
verify: browser
spec: docs/nodes/navigation/ui-pagination.md
tests: tests/e2e/nodes/view/ui-pagination.tests.md
dependencies: [P113]
status: done
---
# P154 — ui-pagination: total + currentPage als typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. `currentPage` folgt dem Input-`value`-Muster: zweiseitig
> (Store/State lesen **und** schreiben) **plus** Change-Event auf dem Out-Port.

## Befund (heute)
- `totalPath` (Gesamtzahl) und `currentPagePath` (aktuelle Seite) sind nackte
  Textfelder. `pageSize` bleibt Config-Number.

## Zielmodell
- `totalPath` → **`total`**: kanonischer Wert-typedInput (lesende Quelle, Default number).
- `currentPagePath` → **`currentPage`**: kanonischer Wert-typedInput, **zweiseitig**
  (liest Initial-/Live-Wert aus Store/State, schreibt die gewählte Seite zurück)
  **und** emittiert weiterhin das page-change-Event. Migration der Pfade →
  `{kind:"state", path}` (Muster P137).

## acceptance (observierbar, browser)
- `total` zeigt die Gesamtzahl aus einem Store/Query-Binding.
- `currentPage` an einen Store gebunden: Seitenwechsel schreibt zurück; eine
  externe Store-Änderung setzt die aktive Seite; zusätzlich kommt das
  change-Event auf dem Out-Port.
- Migration verlustfrei; bestehende ui-pagination-E2E grün.

## spec / tests
- spec: `docs/nodes/navigation/ui-pagination.md` — `total`/`currentPage` als
  typedInput (currentPage zweiseitig + Event).
- tests: `tests/e2e/nodes/view/ui-pagination.tests.md` (neu): total-Binding,
  currentPage zweiseitig + Event, Migration.

## Result

- **delivered:** ui-pagination `totalPath`→`total` (read-only canonical value typedInput, default
  number) and `currentPagePath`→`currentPage` (**two-way** canonical value typedInput, default
  number); `pageSize` stays config; legacy paths migrate losslessly to `{kind:"state",path}`. The
  two-way write-back **reuses the existing input-value machinery — no new event/write-back
  mechanism**: `currentPage` compiles to the schema `page` binding routed through `bind.value`, so
  the renderer resolves the live page from the bound store/state; the page-change `change` event
  (params.page) is unchanged — a page click emits it on the out-port, the wired flow writes the new
  page back to the bound store (declarative store-roundtrip, per the events.md invariant), and
  `currentPage` reads it back reactively over SSE. `total` now routes through `bind.totalPages` so
  state/query/store totals resolve (previously only a literal-in-props). Also fixed a latent editor
  mapper bug (mapped both `page` and `totalPages` from `totalPath`). Touched
  `nodes/view/ui-pagination.html`, `packages/schema/src/node-definitions.ts`, `nodes/webapp.js`,
  `packages/editor/src/nodes.ts`, `packages/renderer/src/renderer.ts`, spec doc.
- **stats:** 9 files; +8 unit (`p154-...test.ts`, runtime →905) + 9 new ui-pagination E2E
  (incl. C02 click→change→wired ui-store set→SSE re-render moves active page; C03 external store
  replace→active page) + editor regression spec updated. Develop verification: `pnpm build` exit 0;
  the authoritative merge run was **529 passed / 0 real failures** (18 ui-pagination specs green)
  with only the known flaky `ui-alert.spec.ts:265` countdown test red — re-ran 19/19 green.
- **notes:** Foundation for **P161** (query reactive paging: total←query, currentPage↔store). The
  environment was unstable on full-suite re-runs this session (one 41m run with 2 cascading
  timeouts in unrelated transport specs `p106`/`p31` — both pass in **14.6s** isolated, confirming
  environmental, not P154). The recurring `ui-alert` countdown flake was flagged for a separate
  test-only fix. One friction-log line added (spec named compiled binding keys, not editor field
  names; pagination runtime mapping lives in webapp.js).
- **cost:** session a0f4c02e1096ec464, ~42m (+ substantial orchestrator E2E incl. flake/env
  rechecks).
