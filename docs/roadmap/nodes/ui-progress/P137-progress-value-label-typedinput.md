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
status: pending
---
# P137 — ui-progress: value + label auf typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
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
