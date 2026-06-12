---
id: P158
node: ui-table
epic: nodes/ui-table
title: "ui-table: rowsPath→value (Daten-Array); columns bleibt separat (Collections)"
findings:
  - "Field-Typing-Audit (2026-06-11): rowsPath ist ein nacktes Textfeld; sollte den Wert-Satz (Daten-Array-Quelle) bekommen."
verify: browser
spec: docs/nodes/display/ui-table.md
tests: tests/e2e/nodes/view/ui-table.tests.md
dependencies: [P113]
status: in_progress
---
# P158 — ui-table: rows als typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. ui-table rendert die Zeilen **selbst** — `rowsPath` ist
> die **Datenquelle** (Array). `columns` (Schema) bleibt separat (Collections).

## Befund (heute)
- `rowsPath` ist ein nacktes Textfeld; `columns` ist ein Textfeld (Spalten-Schema,
  separat); `footer` bleibt Checkbox.

## Zielmodell
- `rowsPath` → **`rows`**: kanonischer Wert-typedInput (Array-Quelle via
  Store/Query/Reactive/JSON-Literal). Migration `→ {kind:"state", path}`.

## acceptance (observierbar, browser)
- `rows` rendert die Tabellenzeilen aus einem Store/Query-Array reaktiv;
  Migration verlustfrei; bestehende ui-table-E2E (inkl. Events) grün.
  `columns` unverändert.

## spec / tests
- spec: `docs/nodes/display/ui-table.md` — `rows` als typedInput.
- tests: `tests/e2e/nodes/view/ui-table.tests.md` (neu): rows-Binding, Migration.
