---
id: P149
node: ui-datepicker
epic: nodes/ui-datepicker
title: "ui-datepicker: placeholder auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-datepicker placeholder ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/input/ui-datepicker.md
tests: tests/e2e/nodes/view/ui-datepicker.tests.md
dependencies: [P113]
status: in_progress
---
# P149 — ui-datepicker: placeholder → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`label` bereits typed (P98/P130) — hier `placeholder`.

## Befund (heute)
- `placeholder` ist ein nacktes `<input type="text">`. (`min`/`max` bleiben als
  Datum-Config — separat zu entscheiden, nicht Teil dieses Pakets.)

## Zielmodell
- `placeholder` → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `placeholder`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert;
  Round-Trip; bestehende ui-datepicker-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-datepicker.md` — `placeholder` als typedInput.
- tests: `tests/e2e/nodes/view/ui-datepicker.tests.md` erweitern.
