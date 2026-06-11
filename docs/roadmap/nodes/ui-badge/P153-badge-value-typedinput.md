---
id: P153
node: ui-badge
epic: nodes/ui-badge
title: "ui-badge: valuePath→value (kanonischer Wert-typedInput)"
findings:
  - "Field-Typing-Audit (2026-06-11): ui-badge valuePath ist ein nacktes Textfeld; sollte value heissen + den Wert-Satz bekommen."
verify: browser
spec: docs/nodes/feedback/ui-badge.md
tests: tests/e2e/nodes/view/ui-badge.tests.md
dependencies: [P113]
status: pending
---
# P153 — ui-badge: valuePath → value-typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. Reines Editor-Paket.

## Befund (heute)
- `valuePath` ist ein nacktes `<input type="text">` (Anzeige-Wert des Badge).
  `displayType`/`variant` bleiben Enum-Select bzw. Farb-Rolle.

## Zielmodell
- `valuePath` → **`value`** (kanonischer Wert-typedInput, `category:"value"`),
  Default string. Migration `valuePath`→`{kind:"state", path}` (Muster P137).

## acceptance (observierbar, browser)
- `value`-typedInput bietet den vollen Satz; Literal/Store/state/reactive zeigen
  den Live-Wert im Badge; `valuePath`-Migration verlustfrei; Round-Trip;
  bestehende ui-badge-E2E grün.

## spec / tests
- spec: `docs/nodes/feedback/ui-badge.md` — `value` (typedInput, Umbenennung).
- tests: `tests/e2e/nodes/view/ui-badge.tests.md` um value-Binding + Migration erweitern.
