---
id: P148
node: ui-textarea
epic: nodes/ui-textarea
title: "ui-textarea: label + placeholder auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-textarea label und placeholder sind nackte Textfelder.)"
verify: browser
spec: docs/nodes/input/ui-textarea.md
tests: tests/e2e/nodes/view/ui-textarea.tests.md
dependencies: [P113]
status: pending
---
# P148 — ui-textarea: label + placeholder → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` bereits typed (P128) — hier `label` + `placeholder`.

## Befund (heute)
- `label` und `placeholder` sind nackte `<input type="text">`.

## Zielmodell
- Beide → kanonischer Wert-typedInput (geteilter Helfer, `category:"value"`), Default string.

## acceptance (observierbar, browser)
- `label` und `placeholder` bieten den vollen Satz; Bindings zeigen Live-Werte;
  Round-Trip; bestehende ui-textarea-E2E grün.

## spec / tests
- spec: `docs/nodes/input/ui-textarea.md` — `label`/`placeholder` als typedInput.
- tests: `tests/e2e/nodes/view/ui-textarea.tests.md` erweitern.
