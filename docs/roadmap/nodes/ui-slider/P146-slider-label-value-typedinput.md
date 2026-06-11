---
id: P146
node: ui-slider
epic: nodes/ui-slider
title: "ui-slider: label auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-slider label ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/input/ui-slider.md
tests: tests/e2e/nodes/view/ui-slider.tests.md
dependencies: [P113]
status: in_progress
---
# P146 — ui-slider: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` bereits typed (P126) — hier nur `label`.

## Befund (heute)
- `label` ist ein nacktes `<input type="text">`.

## Zielmodell
- `label` → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `label`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert; Round-Trip;
  bestehende ui-slider-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-slider.md` — `label` als typedInput.
- tests: `tests/e2e/nodes/view/ui-slider.tests.md` um label-Binding erweitern.
