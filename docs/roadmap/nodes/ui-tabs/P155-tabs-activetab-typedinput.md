---
id: P155
node: ui-tabs
epic: nodes/ui-tabs
title: "ui-tabs: activeTabPath→value (zweiseitig + Change-Event)"
findings:
  - "Field-Typing-Audit (2026-06-11): activeTabPath ist ein nacktes Textfeld; der aktive Tab ist zweiseitig (Binding + Change-Event) wie ein Input-value."
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
dependencies: [P113]
status: in_progress
---
# P155 — ui-tabs: activeTab als typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. **Nur** der aktive Tab — die **Tab-Definition** (`tabs`)
> und dynamische Slots sind separat (Collections / [[P142]]).

## Befund (heute)
- `activeTabPath` ist ein nacktes Textfeld.

## Zielmodell
- `activeTabPath` → **`activeTab`**: kanonischer Wert-typedInput, **zweiseitig**
  (Store/State lesen + schreiben) **plus** das bestehende tab-change-Event.
  Migration `→ {kind:"state", path}`.

## acceptance (observierbar, browser)
- `activeTab` an einen Store gebunden: Tab-Wechsel schreibt zurück; externe
  Store-Änderung aktiviert den Tab; change-Event bleibt. Migration verlustfrei;
  bestehende ui-tabs-E2E grün. (`tabs`-Definition unverändert.)

## spec / tests
- spec: `docs/nodes/navigation/ui-tabs.md` — `activeTab` als typedInput (zweiseitig + Event).
- tests: `tests/e2e/nodes/view/ui-tabs.tests.md` (neu): activeTab zweiseitig + Event, Migration.
