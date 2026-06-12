---
id: P156
node: ui-stepper
epic: nodes/ui-stepper
title: "ui-stepper: activeStepPath→value (zweiseitig + Change-Event)"
findings:
  - "Field-Typing-Audit (2026-06-11): activeStepPath ist ein nacktes Textfeld; der aktive Step ist zweiseitig (Binding + Change-Event)."
verify: browser
spec: docs/nodes/navigation/ui-stepper.md
tests: tests/e2e/nodes/view/ui-stepper.tests.md
dependencies: [P113]
status: in_progress
---
# P156 — ui-stepper: activeStep als typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. **Nur** der aktive Step — die **Step-Definition** (`steps`)
> ist separat (Collections).

## Befund (heute)
- `activeStepPath` ist ein nacktes Textfeld; `orientation` bleibt Enum-Select.

## Zielmodell
- `activeStepPath` → **`activeStep`**: kanonischer Wert-typedInput, **zweiseitig**
  (Store/State lesen + schreiben) **plus** das bestehende step-change-Event.
  Migration `→ {kind:"state", path}`.

## acceptance (observierbar, browser)
- `activeStep` an einen Store gebunden: Step-Wechsel schreibt zurück; externe
  Store-Änderung aktiviert den Step; change-Event bleibt. Migration verlustfrei;
  bestehende ui-stepper-E2E grün.

## spec / tests
- spec: `docs/nodes/navigation/ui-stepper.md` — `activeStep` als typedInput.
- tests: `tests/e2e/nodes/view/ui-stepper.tests.md` (neu): activeStep zweiseitig + Event.
