---
id: P150
node: ui-divider
epic: nodes/ui-divider
title: "ui-divider: label auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-divider label ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/display/ui-divider.md
tests: tests/e2e/nodes/view/ui-divider.tests.md
dependencies: [P113]
status: in_progress
---
# P150 — ui-divider: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Reines Editor-Paket.

## Befund (heute)
- `label` ist ein nacktes `<input type="text">`. (`orientation` bleibt Enum-Select.)

## Zielmodell
- `label` → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `label`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert;
  Round-Trip; bestehende ui-divider-E2E grün.

## spec / tests
- spec: `docs/nodes/display/ui-divider.md` — `label` als typedInput.
- tests: `tests/e2e/nodes/view/ui-divider.tests.md` (neu/erweitern): label-Binding.
