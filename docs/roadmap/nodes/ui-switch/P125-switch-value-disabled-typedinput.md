---
id: P125
node: ui-switch
epic: nodes/ui-switch
title: "ui-switch: value→kanonischer typedInput (Anzeige/Initial, voller Satz) + valuePath-Migration; bindbares disabled (Boolean-Zustand, inkl. Store)"
findings:
  - "alle values möglichst immer auch alle Bindings bekommen. Das gilt für alle values in allen Knoten. Reduzieren wollen wir nur da, wo es zwingend oder sinnvoll ist."
  - "Gerade bei Disabled ist ein Store-Binding unbedingt nötig."
verify: browser
spec: docs/nodes/input/ui-switch.md
tests: tests/e2e/nodes/view/ui-switch.tests.md
dependencies: [P113]
status: in_progress
---
# P125 — ui-switch: value + disabled auf typedInput

> Prinzip & Matrix: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament: **P113**. **Präzedenz:** ui-checkbox (P97) ist der nächste
> Verwandte (Boolean-Control) — value→typedInput inkl. valuePath-Migration
> exakt diesem Muster folgen. Reines Editor-Paket.

## Befund (heute)

- `value` nutzt das Legacy-Muster `valuePath` (Pflicht) + `value` — kein
  typedInput. `labelOn`/`labelOff` separat (hier nicht angefasst).
- Kein bindbares `disabled`.

## Zielmodell (Editor)

1. **`value`** → kanonischer **Wert/Anzeige**-typedInput; da ui-switch boolesch
   ist, ist der literale Default-Typ `boolean` (Literal-Label „Boolean", wie
   P97-Checkbox). Migration `valuePath`→`{kind:"state",path}`; Zurückschreiben
   unverändert.
2. **`disabled`** → neues **Boolean-Zustand**-typedInput (inkl. **Store**).

## acceptance (observierbar, browser)

- `value`-typedInput bietet den vollen Satz (literaler Default `boolean`);
  Store/state zeigt Initial; Umschalten schreibt weiterhin zurück.
- `valuePath`-Migration verlustfrei.
- `disabled` mit Store-Binding deaktiviert den Switch live, sobald truthy.
- Round-Trip; bestehende ui-switch-E2E grün.

## spec / tests

- `docs/nodes/input/ui-switch.md`: `value` + `disabled` als typedInput
  dokumentieren; ADR 0012 referenzieren.
- `tests/e2e/nodes/view/ui-switch.tests.md`: value-Binding, valuePath-Migration,
  disabled-Store-Binding.
