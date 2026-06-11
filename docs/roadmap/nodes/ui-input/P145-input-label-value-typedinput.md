---
id: P145
node: ui-input
epic: nodes/ui-input
title: "ui-input: label auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-input label ist ein nacktes Textfeld.)"
verify: browser
spec: docs/nodes/input/ui-input.md
tests: tests/e2e/nodes/view/ui-input.tests.md
dependencies: [P113]
status: in_progress
---
# P145 — ui-input: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `value`/`disabled` sind bereits typed (P123) — hier nur `label`. Reines Editor-Paket.

## Befund (heute)

- `label` ist ein nacktes `<input type="text">`.

## Zielmodell

- `label` → kanonischer **Wert/Anzeige**-typedInput (geteilter Helfer,
  `category:"value"`), Default string. Muster wie die übrigen Label-Felder.

## acceptance (observierbar, browser)

- `label`-typedInput bietet den vollen Satz; Binding zeigt den Live-Wert;
  Round-Trip; bestehende ui-input-E2E grün.

## spec / tests

- spec: `docs/nodes/input/ui-input.md` — `label` als typedInput.
- tests: `tests/e2e/nodes/view/ui-input.tests.md` um label-Binding erweitern.
