---
id: P144
node: ui-button
epic: nodes/ui-button
title: "ui-button: label auf kanonischen Wert-typedInput (P113-Rollout-Lücke)"
findings:
  - "Ich sehe immer noch viele felder, die nicht getyped sind. (Audit: ui-button label ist noch ein nacktes Textfeld, obwohl P113 es abdecken sollte.)"
verify: browser
spec: docs/nodes/display/ui-button.md
tests: tests/e2e/nodes/view/ui-button.tests.md
dependencies: [P113]
status: in_progress
---
# P144 — ui-button: label → Wert-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Schließt die P113-Lücke: `label` blieb ein nacktes Textfeld. Reines Editor-Paket.

## Befund (heute)

- `label` ist ein nacktes `<input type="text">` (kein typedInput) — `disabled`/
  `href` sind bereits typed (P122), `label` wurde übersehen.

## Zielmodell

- `label` → kanonischer **Wert/Anzeige**-typedInput (`valueBindingTypes({category:"value"})`,
  geteilter Helfer). Persistiert als Binding-Objekt; Default-Typ string. Muster
  exakt wie die bereits umgestellten Label-Felder (ui-checkbox/-select).

## acceptance (observierbar, browser)

- `label`-typedInput bietet den vollen kanonischen Satz; Literal zeigt den Text;
  Store-/state-/reactive-Binding zeigt den Live-Wert.
- Round-Trip des Binding-Objekts über Schließen/Öffnen; bestehende ui-button-E2E grün.

## spec / tests

- spec: `docs/nodes/display/ui-button.md` — `label` als typedInput dokumentieren.
- tests: `tests/e2e/nodes/view/ui-button.tests.md` um label-Binding erweitern.
