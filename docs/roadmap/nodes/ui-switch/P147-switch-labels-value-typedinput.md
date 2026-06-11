---
id: P147
node: ui-switch
epic: nodes/ui-switch
title: "ui-switch: label/labelOn/labelOff auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-switch label, labelOn, labelOff sind nackte Textfelder.)"
verify: browser
spec: docs/nodes/input/ui-switch.md
tests: tests/e2e/nodes/view/ui-switch.tests.md
dependencies: [P113]
status: in_progress
---
# P147 — ui-switch: label/labelOn/labelOff → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` bereits typed (P125) — hier die drei Label-Felder.

## Befund (heute)
- `label`, `labelOn`, `labelOff` sind nackte `<input type="text">`.

## Zielmodell
- Alle drei → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`),
  Default string.

## acceptance (observierbar, browser)
- Die drei Label-Felder bieten den vollen Satz; Bindings zeigen Live-Werte;
  Round-Trip; bestehende ui-switch-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-switch.md` — `label`/`labelOn`/`labelOff` als typedInput.
- tests: `tests/e2e/nodes/view/ui-switch.tests.md` um die Label-Bindings erweitern.
