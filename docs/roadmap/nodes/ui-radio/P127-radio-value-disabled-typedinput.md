---
id: P127
node: ui-radio
epic: nodes/ui-radio
title: "ui-radio: value→kanonischer typedInput (Anzeige/Initial, voller Satz) + valuePath-Migration; bindbares disabled (Boolean-Zustand, inkl. Store)"
findings:
  - "alle values möglichst immer auch alle Bindings bekommen. Das gilt für alle values in allen Knoten. Reduzieren wollen wir nur da, wo es zwingend oder sinnvoll ist."
  - "Gerade bei Disabled ist ein Store-Binding unbedingt nötig."
verify: browser
spec: docs/nodes/input/ui-radio.md
tests: tests/e2e/nodes/view/ui-radio.tests.md
dependencies: [P113]
status: pending
---
# P127 — ui-radio: value + disabled auf typedInput

> Prinzip & Matrix: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament: **P113**. **Präzedenz:** ui-checkbox (P97)/ui-datepicker (P98) —
> value→typedInput inkl. valuePath-Migration exakt diesem Muster folgen. Reines
> Editor-Paket.

## Befund (heute)

- `value` nutzt das Legacy-Muster `valuePath` (Pflicht) + `storeId` + `value` —
  kein typedInput. Optionen aus `optionsJson`/`optionsBinding` (nicht angefasst).
- Kein bindbares `disabled`.

## Zielmodell (Editor)

1. **`value`** → kanonischer **Wert/Anzeige**-typedInput (voller P113-Satz);
   Migration `valuePath`→`{kind:"state",path}` wie P97/P98; Zurückschreiben
   unverändert.
2. **`disabled`** → neues **Boolean-Zustand**-typedInput (inkl. **Store**).

## acceptance (observierbar, browser)

- `value`-typedInput bietet den vollen Satz; Store/state zeigt Initial; Auswahl
  schreibt weiterhin zurück.
- `valuePath`-Migration verlustfrei.
- `disabled` mit Store-Binding deaktiviert die Radiogruppe live, sobald truthy.
- Round-Trip; bestehende ui-radio-E2E grün; Optionen unverändert.

## spec / tests

- `docs/nodes/input/ui-radio.md`: `value` + `disabled` als typedInput
  dokumentieren; ADR 0012 referenzieren.
- `tests/e2e/nodes/view/ui-radio.tests.md`: value-Binding, valuePath-Migration,
  disabled-Store-Binding.
