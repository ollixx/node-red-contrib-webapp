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
status: done
---
# P125 — ui-switch: value + disabled auf typedInput

> Prinzip & Matrix: [ADR 0012](../../../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).
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

## Result

- **delivered:** ui-switch: `value`→kanonischer typedInput (Default-Subtyp bool) + valuePath→state-Migration; bindbares `disabled` (boolean, inkl. Store). Konsumiert den kanonischen P113-Helfer (`valueBindingTypes`/`readValueBinding`/`applyValueBinding`) — **keine** Helfer-Redefinition (editor-common.js-Delta 0). Muster = ui-button (P122).
- **stats:** Reine Editor-Phase (Schema/Runtime waren seit P71/P97 binding-objekt-fähig). Neue E2E-Specs geschrieben. Maßgebliche volle E2E auf gebautem develop nach Batch-1-Fix: **456 passed, exit=0, 0 failed**. Unit 871.
- **notes:** Teil von Batch 1 (P123/P124/P125 parallel, implementation-only). Die volle Batch-Verifikation deckte 5 Fehler auf, behoben in fix/batch1-e2e: 2 Cross-Cutting-Stale-Specs (view.spec.ts valuePath), 1 Spec-Bug (ui-select store-API) und **2 echte Impl-Lücken**, die die neuen Specs korrekt fanden — `placeholder` war im ui-input nirgends durchverdrahtet (webapp.js mapConfig/props + serializer) und das `submit`-Event war client-seitig nie implementiert (webapp-client.js). P113-Ancestor bei Merge verifiziert.
- **cost:** session (Batch 1, sonnet) + anteilig Batch-1-Fix (opus, ~14m).
