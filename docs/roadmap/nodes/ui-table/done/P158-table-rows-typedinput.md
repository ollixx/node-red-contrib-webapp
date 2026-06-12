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
status: done
---
# P158 — ui-table: rows als typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
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

## Result

- **delivered:** ui-table `rowsPath`→`rows` converted to a canonical **structural-array**
  data-source typedInput (default json/literal array; store/query/reactive/literal), resolved
  through the EXACT `resolveStructuralBinding` path reused from ui-select `options` (P133) and
  ui-menu `items` (P157), routed via its own `bind.rows` (not the scalar display path). Legacy
  `rowsPath` migrates loss-free to `{kind:"state",path}` across editor, HTML panel, and both
  webapp.js mappers. `columns` (Collections) and `footer` (checkbox) untouched. Touched
  `packages/renderer/src/renderer.ts`, `packages/editor/src/nodes.ts`, `nodes/webapp.js`,
  `nodes/view/ui-table.html`, spec doc; `examples/customers-crud/flow.json` regenerated via
  `pnpm gen:example` (compliant — not hand-edited; 4-line change).
- **stats:** 9 files; +4 ui-table E2E (store-array rows reactive + rowsPath migration, in the
  composite render spec + the view editor panel). Develop verification: `pnpm build` exit 0, full
  Playwright suite **543 passed / 0 failed** (8.9m); 1373 unit green; check:roadmap + check:links +
  lint OK. **customers-crud stayed green** — the table-render integration test ("LIST: seeded
  customers appear in the table") passes, confirming the rename+migration is loss-free.
- **notes:** `gen:example` also surfaced a pre-existing UNRELATED badge `severity`→`variant`/
  `displayType` generator-vs-source drift (the small flow.json delta); it is canonical generated
  output, logged in the friction log. The sub-agent observed 7 navigate-driven CRUD `@integration`
  tests failing — **verified pre-existing on the clean P158 base** (stash → identical 7 failures),
  a documented host Node-RED navigate-runtime breakage; these are NOT in the authoritative default
  `pnpm exec playwright test` suite (which is why every phase this run shows 0 failed) and are not
  a P158 regression. Reused P133/P157 structural path — no new mechanism.
- **cost:** session afa73742368f0c8d0, ~38m (orchestrator develop-E2E on top).
