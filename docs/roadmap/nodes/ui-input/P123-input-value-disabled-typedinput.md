---
id: P123
node: ui-input
epic: nodes/ui-input
title: "ui-input: value→kanonischer typedInput (Anzeige/Initial, voller Satz) + valuePath-Migration; bindbares disabled (Boolean-Zustand, inkl. Store)"
findings:
  - "alle values möglichst immer auch alle Bindings bekommen. Das gilt für alle values in allen Knoten. Reduzieren wollen wir nur da, wo es zwingend oder sinnvoll ist."
  - "Gerade bei Disabled ist ein Store-Binding unbedingt nötig."
verify: browser
spec: docs/nodes/input/ui-input.md
tests: tests/e2e/nodes/view/ui-input.tests.md
dependencies: [P113]
status: in_progress
---
# P123 — ui-input: value + disabled auf typedInput

> Prinzip & Matrix: [ADR 0012](../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament: **P113** (Kategorie-Typsätze). **Präzedenz:** ui-checkbox (P97) und
> ui-datepicker (P98) haben genau diese value→typedInput-Umstellung inkl.
> valuePath-Migration bereits umgesetzt — diesem Muster exakt folgen. Reines
> Editor-Paket (Runtime kann beides bereits).

## Befund (heute)

- `value` nutzt das Legacy-Muster: `valuePath` (Pflicht, roher state-Pfad) +
  `storeId` + `value` — kein typedInput.
- Kein bindbares `disabled`.

## Zielmodell (Editor)

1. **`value`** wird der kanonische **Wert/Anzeige**-typedInput (voller
   P113-Satz) — die *Anzeige-/Initial*-Bindung, persistiert als Binding-Objekt
   in `value`. Vorgehen **wie P97/P98**: `bindingTypedInputTypes`/kanonischer
   Helfer, Migration eines bestehenden `valuePath` → `{kind:"state",
   path:<valuePath>}` beim ersten Öffnen, danach `valuePath` leeren. Das
   **Zurückschreib-Ziel** (wohin der User-Input persistiert) bleibt erhalten —
   `value` ist nur Anzeige/Initial; die Zurückschreib-Mechanik unverändert
   übernehmen wie in P97/P98.
2. **`disabled`** neues **Boolean-Zustand**-typedInput (Store, Query,
   Route-Param, Reactive, msg, JSONata, **boolean**, Flow, Global, Env).
   Persistiert als Binding-Objekt; kein Legacy zu migrieren.

## acceptance (observierbar, browser)

- `value`-typedInput bietet den vollen kanonischen Satz; `Store`/`state`-Binding
  zeigt den Live-Wert als Initial; User-Eingabe wird weiterhin korrekt
  zurückgeschrieben (wie vor der Umstellung).
- Migration: vor-P123-Knoten mit `valuePath` öffnet als `state`-Binding mit
  demselben Pfad; Verhalten unverändert.
- `disabled`-typedInput bietet den Boolean-Zustand-Satz inkl. **Store**;
  `Store → <ui-store>` deaktiviert das Eingabefeld live, sobald truthy.
- Round-Trip beider Binding-Objekte über Schließen/Öffnen; bestehende
  ui-input-E2E bleiben grün.

## spec / tests

- `docs/nodes/input/ui-input.md`: `value` (typedInput, Anzeige/Initial +
  Zurückschreib-Ziel) und `disabled` (typedInput, Boolean-Zustand) umschreiben;
  ADR 0012 referenzieren.
- `tests/e2e/nodes/view/ui-input.tests.md`: value-Binding, valuePath-Migration,
  disabled-Store-Binding.
