---
id: P129
node: ui-checkbox
epic: nodes/ui-checkbox
title: "ui-checkbox: bindbares disabled (Boolean-Zustand-typedInput, inkl. Store)"
findings:
  - "alle values möglichst immer auch alle Bindings bekommen. Gerade bei Disabled ist ein Store-Binding unbedingt nötig. Das gilt für alle values in allen Knoten."
verify: browser
spec: docs/nodes/input/ui-checkbox.md
tests: tests/e2e/nodes/view/ui-checkbox.tests.md
dependencies: [P113]
status: pending
---
# P129 — ui-checkbox: bindbares disabled

> Prinzip & Matrix: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament: **P113**. `value` ist bereits typedInput (P97) — dieses Paket
> ergänzt **nur** ein bindbares `disabled`. Reines Editor-Paket (Runtime löst
> `bind.disabled` bereits auf).

## Zielmodell (Editor)

- Neues Feld **`disabled`** als **Boolean-Zustand**-typedInput aus dem
  P113-Helfer: Store, Query, Route-Param, Reactive, msg, JSONata, **boolean**,
  Flow, Global, Env. Persistiert als Binding-Objekt. Default: kein Binding
  (Control aktiv). Kein Legacy-Feld zu migrieren (ui-checkbox hat heute kein
  disabled).

## acceptance (observierbar, browser)

- `disabled`-typedInput bietet genau den Boolean-Zustand-Satz inkl. **Store**;
  `Store → <ui-store>` deaktiviert die Checkbox live, sobald truthy; Round-Trip
  des Binding-Objekts über Schließen/Öffnen.
- Bestehende ui-checkbox-E2E (value/label) bleiben grün.

## spec / tests

- `docs/nodes/input/ui-checkbox.md`: Feld `disabled` (typedInput, Boolean-
  Zustand) dokumentieren; ADR 0012 referenzieren.
- `tests/e2e/nodes/view/ui-checkbox.tests.md`: disabled-Store-Binding-Fall.
