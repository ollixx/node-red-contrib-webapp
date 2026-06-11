---
id: P157
node: ui-menu
epic: nodes/ui-menu
title: "ui-menu: itemsPath→value (Daten-Array), activeRoutePath→value"
findings:
  - "Field-Typing-Audit (2026-06-11): itemsPath und activeRoutePath sind nackte Textfelder; sollten den Wert-Satz bekommen."
verify: browser
spec: docs/nodes/navigation/ui-menu.md
tests: tests/e2e/nodes/view/ui-menu.tests.md
dependencies: [P113]
status: pending
---
# P157 — ui-menu: items + activeRoute als typedInput

> Prinzip: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Field-Typing Welle 2. ui-menu rendert seine Items **selbst** (kein Slot-pro-Item)
> — `itemsPath` ist eine **Datenquelle** (Array), kein Repeats-Fall (vgl. ui-list
> [[P140]]).

## Befund (heute)
- `itemsPath` (Menü-Items-Array) und `activeRoutePath` (aktive Route) sind nackte
  Textfelder; `displayType` bleibt Enum-Select.

## Zielmodell
- `itemsPath` → **`items`**: kanonischer Wert-typedInput (Array-Quelle via
  Store/Query/Reactive/JSON-Literal).
- `activeRoutePath` → **`activeRoute`**: kanonischer Wert-typedInput (aktive Route;
  typischerweise routeParam/store). Migration der Pfade `→ {kind:"state", path}`.

## acceptance (observierbar, browser)
- `items` rendert die Menü-Einträge aus einem Store/Query-Array reaktiv.
- `activeRoute` markiert den aktiven Eintrag aus einem Binding.
- Migration verlustfrei; bestehende ui-menu-E2E grün.

## spec / tests
- spec: `docs/nodes/navigation/ui-menu.md` — `items`/`activeRoute` als typedInput.
- tests: `tests/e2e/nodes/view/ui-menu.tests.md` (neu): items-Binding, activeRoute, Migration.
