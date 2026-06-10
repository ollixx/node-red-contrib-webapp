---
id: P128
node: ui-textarea
epic: nodes/ui-textarea
title: "ui-textarea: value→kanonischer typedInput (Anzeige/Initial, voller Satz) + valuePath-Migration; bindbares disabled (Boolean-Zustand, inkl. Store)"
findings:
  - "alle values möglichst immer auch alle Bindings bekommen. Das gilt für alle values in allen Knoten. Reduzieren wollen wir nur da, wo es zwingend oder sinnvoll ist."
  - "Gerade bei Disabled ist ein Store-Binding unbedingt nötig."
verify: browser
spec: docs/nodes/input/ui-textarea.md
tests: tests/e2e/nodes/view/ui-textarea.tests.md
dependencies: [P113]
status: pending
---
# P128 — ui-textarea: value + disabled auf typedInput

> Prinzip & Matrix: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament: **P113**. **Präzedenz:** ui-input ist der nächste Verwandte
> (Text-Control); value→typedInput inkl. valuePath-Migration wie P97/P98. Reines
> Editor-Paket.

## Befund (heute)

- `value` nutzt das Legacy-Muster `valuePath` (Pflicht) + `value` — kein
  typedInput. `placeholder`/`rows` separat (nicht angefasst).
- Kein bindbares `disabled`.

## Zielmodell (Editor)

1. **`value`** → kanonischer **Wert/Anzeige**-typedInput (voller P113-Satz);
   literaler Default-Typ `string`. Migration `valuePath`→`{kind:"state",path}`;
   Zurückschreiben unverändert.
2. **`disabled`** → neues **Boolean-Zustand**-typedInput (inkl. **Store**).

## acceptance (observierbar, browser)

- `value`-typedInput bietet den vollen Satz; Store/state zeigt Initial; Tippen
  schreibt weiterhin zurück.
- `valuePath`-Migration verlustfrei.
- `disabled` mit Store-Binding deaktiviert die Textarea live, sobald truthy.
- Round-Trip; bestehende ui-textarea-E2E grün.

## spec / tests

- `docs/nodes/input/ui-textarea.md`: `value` + `disabled` als typedInput
  dokumentieren; ADR 0012 referenzieren.
- `tests/e2e/nodes/view/ui-textarea.tests.md`: value-Binding, valuePath-
  Migration, disabled-Store-Binding.
