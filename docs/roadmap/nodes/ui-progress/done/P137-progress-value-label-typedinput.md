---
id: P137
node: ui-progress
epic: nodes/ui-progress
title: "ui-progress: valuePath→value (kanonischer typedInput) + label auf Wert-Satz"
findings:
  - "value path sollte wohl auch 'value' heissen und typedinputs bekommen"
  - "genauso 'label'"
verify: browser
spec: docs/nodes/feedback/ui-progress.md
tests: tests/e2e/nodes/view/ui-progress.tests.md
dependencies: [P113]
status: done
---
# P137 — ui-progress: value + label auf typedInput

> Prinzip: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Präzedenz: die Input-Control-Pakete P123–P128 (value→typedInput inkl.
> valuePath-Migration). Reines Editor-/Render-Paket.

## Befund (heute)

- `valuePath` ist ein nacktes Textfeld („Value Path"); `value` ist kein
  typedInput. `label` ist ebenfalls ein nacktes Textfeld.

## Zielmodell (Editor)

1. **`value`** (umbenannt von `valuePath`) → kanonischer **Wert/Anzeige**-
   typedInput (P113), literaler Default `number` (Fortschritt 0…max). Migration
   `valuePath`→`{kind:"state", path:<valuePath>}` beim ersten Öffnen (Muster
   P123ff.). Feld-Label heißt „Value".
2. **`label`** → kanonischer Wert-Satz statt nacktem Textfeld.
3. `showValue`/`displayType` unverändert.

## acceptance (observierbar, browser)

- `value`-typedInput bietet den vollen kanonischen Satz; literaler `number`-Wert
  setzt den Fortschritt; Store-/state-Binding zeigt den Live-Wert.
- `valuePath`-Migration verlustfrei (Alt-Knoten öffnet als state-Binding).
- `label` bietet den Wert-Satz; Binding zeigt den Live-Wert.
- Bestehende ui-progress-E2E bleiben grün.

## spec / tests

- spec: `docs/nodes/feedback/ui-progress.md` — `value` (typedInput, Umbenennung)
  + `label` (Wert-Satz) dokumentieren.
- tests: `tests/e2e/nodes/view/ui-progress.tests.md` (neu/erweitern): value-Binding,
  valuePath-Migration, label-Binding.

## Result

- **delivered:** ui-progress `valuePath` renamed to `value` as the canonical P113 value/display
  typedInput (literal default `number`), with a lossless load-shim `valuePath`→`{kind:"state",
  path:<valuePath>}`; `label`→canonical value typedInput (back-compat plain string preserved);
  `showValue`/`displayType` unchanged. Touched `packages/schema/src/node-definitions.ts` (label
  union binding-or-string), `nodes/view/ui-progress.html` (valueBinding/labelBinding typedInputs
  + oneditprepare migration + oneditsave), `nodes/webapp.js` ("progress" added to labelBinding
  routing so `bind.label` populates), `packages/editor/src/nodes.ts` (UiProgressEditorConfig
  value/label + valuePath fallback). `renderer.ts` needed no change — label resolution already
  flows through the existing `bind.label → resolvedProps.label` path (P97/P98/P133/P136).
- **stats:** 5 files changed; +9 unit tests (`packages/runtime/test/p137-...test.ts`, runtime
  882→891) covering migration, binding forms, back-compat, indeterminate state. Develop
  verification: `pnpm build` exit 0, full Playwright suite **512 passed / 0 failed** (existing
  ui-progress E2E green); check:roadmap + check:links + lint OK.
- **notes:** Field-typing followed the P123–P128 precedent and consumed the P113 canonical
  typedInput helper (not reinvented); `#node-input-value`/`#node-input-label` kept per
  convention. Coverage added as **unit** tests rather than new E2E specs (the package's
  tests-note also listed E2E value/migration/label cases); the migration + binding forms are
  fully unit-covered and the existing ui-progress E2E stayed green — a dedicated E2E backfill
  could be a later write-tests pass if the owner wants browser-level coverage.
- **cost:** session abb40d0bf3cc3f1eb, ~6m (orchestrator develop-E2E on top).
