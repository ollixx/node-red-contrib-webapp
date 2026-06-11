---
id: P151
node: ui-image
epic: nodes/ui-image
title: "ui-image: alt + fallback auf kanonischen Wert-typedInput"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-image alt und fallback sind nackte Textfelder.)"
verify: browser
spec: docs/nodes/display/ui-image.md
tests: tests/e2e/nodes/view/ui-image.tests.md
dependencies: [P113]
status: pending
---
# P151 — ui-image: alt + fallback → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> `src` ist bereits typed — hier `alt` + `fallback`. Reines Editor-Paket.

## Befund (heute)
- `alt` und `fallback` sind nackte `<input type="text">`. (`width`/`height`
  bleiben Maß-Config; `fit` bleibt Enum-Select.)

## Zielmodell
- `alt` → kanonischer Wert-typedInput (`category:"value"`).
- `fallback` → kanonischer Wert-typedInput (Anzeige-Text/-URL bei Ladefehler);
  Default string.

## acceptance (observierbar, browser)
- `alt` und `fallback` bieten den vollen Satz; Bindings zeigen Live-Werte;
  Round-Trip; bestehende ui-image-E2E grün.

## spec / tests
- spec: `docs/nodes/display/ui-image.md` — `alt`/`fallback` als typedInput.
- tests: `tests/e2e/nodes/view/ui-image.tests.md` erweitern.
