---
id: P181
title: "installBaseFields: visible/disabled brauchen einen gültigen Boolean-Default-Typ — leeres Feld fällt auf 'str' (nicht im boolean-Set) → Node-RED zeigt das erste Listenelement (store) mit leerem Dropdown + '…'"
epic: aspects/editor
findings:
  - "Owner (2026-06-14, wie im ui-pagination-Screenshot): 'Visible und Disabled sehen immer noch so kaputt aus … mit diesem extra-leeren Dropdown und den \"...\" rechts. Können wir das bitte in allen Knoten glatt ziehen? Fehlt da ein default type, oder warum taucht das da auf?'"
  - "Code-Befund: installBaseFields setzt visible/disabled mit default: visibleEditor.type OHNE Fallback. readValueBinding(undefined) liefert {type:'str'}. Die boolean-Kategorie (valueBindingTypes) ist [store, query, routeParam, reactive, msg, jsonata, bool, flow, global, env] — 'str' ist KEIN Mitglied. Node-RED setzt daher einen ungültigen Typ und fällt auf den ERSTEN Listeneintrag (store) zurück → store-valueLabel rendert das leere Dropdown + '…'-Expand. Die Wert-Felder (items/currentPage) haben einen Fallback ('str'→'json'/'num'); die Base-Felder nicht."
acceptance:
  - "Ein frisches/leeres visible- bzw. disabled-Feld rendert ein SAUBERES Boolean-typedInput: Default-Typ 'bool' (literal), EIN Typ-Selektor, KEIN store-Control, KEIN leeres Dropdown, KEIN '…'."
  - "Gilt für ALLE Knoten — der Fix sitzt zentral in installBaseFields (resources/lib/editor-common.js); Stichprobe an ui-list, ui-pagination, ui-button, ui-text zeigt überall das saubere Boolean-Control."
  - "Roundtrip: ein gespeichertes visible/disabled-Binding (state/store/reactive/bool/…) öffnet unverändert im richtigen Typ; ein unberührtes leeres Feld erzeugt beim Speichern KEIN künstliches Binding (leer = 'kein Binding', Semantik 'sichtbar'/'aktiv' bleibt)."
  - "color (value-Kategorie, enthält 'str') bleibt unverändert korrekt — nicht betroffen."
verify: browser
spec: docs/nodes/concepts/editor.md
tests: tests/e2e/nodes/editor/base-fields.spec.ts
dependencies: []
status: pending
---
# P181 — Base-Field Boolean-Default-Typ (visible/disabled glatt ziehen)

> Zentraler Editor-Fix. Das „extra-leere Dropdown + '…'" an visible/disabled ist
> **kein** Store-Layout-Problem (P174), sondern ein **fehlender gültiger
> Default-Typ**: das leere Feld bekommt `'str'`, das im **boolean**-Typenset nicht
> existiert → Node-RED zeigt den ersten Eintrag (`store`) mit seinem
> Expand/Sub-Pfad. Eine Stelle, alle Knoten.

## Kern des Fixes

In `installBaseFields` (visible/disabled) den Default-Typ wie bei den Wert-Feldern
absichern — `'str'` (= leer) auf einen **gültigen boolean-Typ** abbilden:

```js
var vtype = visibleEditor.type !== "str" ? visibleEditor.type : "bool";
visibleInput.typedInput({ default: vtype, types: valueBindingTypes({ category: "boolean" }) });
visibleInput.typedInput("type", visibleEditor.type !== "str" || visibleBinding ? visibleEditor.type : "bool");
// dito disabled
```

`'bool'` ist der literale Boolean-Typ aus dem Set; er rendert ein sauberes
true/false-Control statt des store-Fallbacks.

## Save-Semantik (wichtig)

`oneditsave`/`applyBaseFields` muss ein **unberührtes, leeres** Boolean-Feld
weiterhin als **„kein Binding"** persistieren (leer = sichtbar/aktiv), **nicht**
als synthetisches `{kind:literal,value:true}`. Der reine Default-Typ-Wechsel im
Editor darf die gespeicherte Form nicht verändern. (Test: Knoten ohne Berührung
von visible/disabled öffnen→speichern→Diff leer.)

## acceptance / verify

- `verify: browser` — die sauberen Controls an mehreren Knoten beweisen; E2E im
  Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- `tests/e2e/nodes/editor/base-fields.spec.ts` erweitern: ein leeres visible/
  disabled rendert genau einen Typ-Selektor + Boolean-Control (kein store-Marker,
  kein `…`-Expand).

## Risiken / Hinweise

- **Nur** der Default-Typ bei leerem Feld ändert sich; gespeicherte Bindings und
  die Save-Semantik bleiben unangetastet.
- Verwandt, aber getrennt von **P174** (store-typedInput Zwei-Zeilen-Layout) —
  das hier ist der fehlende Boolean-Default, nicht das Store-Rendering.
