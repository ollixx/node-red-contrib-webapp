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
status: in_progress
---
# P154 — ui-pagination: total + currentPage als typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
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
