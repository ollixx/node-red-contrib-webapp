---
id: P126
node: ui-slider
epic: nodes/ui-slider
title: "ui-slider: value→kanonischer typedInput (Anzeige/Initial, voller Satz) + valuePath-Migration; bindbares disabled (Boolean-Zustand, inkl. Store)"
findings:
  - "alle values möglichst immer auch alle Bindings bekommen. Das gilt für alle values in allen Knoten. Reduzieren wollen wir nur da, wo es zwingend oder sinnvoll ist."
  - "Gerade bei Disabled ist ein Store-Binding unbedingt nötig."
verify: browser
spec: docs/nodes/input/ui-slider.md
tests: tests/e2e/nodes/view/ui-slider.tests.md
dependencies: [P113]
status: done
---
# P126 — ui-slider: value + disabled auf typedInput

> Prinzip & Matrix: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
> Fundament: **P113**. **Präzedenz:** ui-datepicker (P98)/ui-checkbox (P97) —
> value→typedInput inkl. valuePath-Migration exakt diesem Muster folgen. Reines
> Editor-Paket.

## Befund (heute)

- `value` nutzt das Legacy-Muster `valuePath` (Pflicht) + `value` — kein
  typedInput. `min`/`max` separat (nicht angefasst).
- Kein bindbares `disabled`.

## Zielmodell (Editor)

1. **`value`** → kanonischer **Wert/Anzeige**-typedInput; literaler
   Default-Typ `number`. Migration `valuePath`→`{kind:"state",path}`;
   Zurückschreiben unverändert.
2. **`disabled`** → neues **Boolean-Zustand**-typedInput (inkl. **Store**).

## acceptance (observierbar, browser)

- `value`-typedInput bietet den vollen Satz (literaler Default `number`);
  Store/state zeigt Initial; Schieben schreibt weiterhin zurück.
- `valuePath`-Migration verlustfrei.
- `disabled` mit Store-Binding deaktiviert den Slider live, sobald truthy.
- Round-Trip; bestehende ui-slider-E2E grün.

## spec / tests

- `docs/nodes/input/ui-slider.md`: `value` + `disabled` als typedInput
  dokumentieren; ADR 0012 referenzieren.
- `tests/e2e/nodes/view/ui-slider.tests.md`: value-Binding, valuePath-Migration,
  disabled-Store-Binding.

## Result

- **delivered:** ui-slider: `value`→kanonischer typedInput (Default-Subtyp num) + valuePath→state-Migration; bindbares `disabled`. Konsumiert den kanonischen P113-Helfer (`valueBindingTypes`/`readValueBinding`/`applyValueBinding`) — keine Helfer-Redefinition (editor-common.js-Delta 0). Muster = ui-input (P123).
- **stats:** Reine Editor-(+Serializer-)Phase. Eigene E2E-Spec im Worktree verifiziert (self-verified Batch-2-Strategie). Batch-2-Cross-Check auf gebautem develop: **474 passed** (die eine rote Stelle war der flaky, isoliert grüne P112-Route-Lifecycle-Test — kein Bezug zu diesem Paket). Unit 871.
- **notes:** Serializer-Gap gefixt: `<sl-range>` emittierte `disabled` nicht. P113-Ancestor + In-Scope-Commits bei Merge verifiziert. `view.spec.ts` für diesen Knoten geprüft/nachgezogen.
- **cost:** Batch 2 (sonnet, self-verified, ~4-8m je).
