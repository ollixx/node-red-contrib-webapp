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
status: done
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

## Result

- **delivered:** `visible`/`disabled` base fields now get a valid **boolean default typedInput type**
  (`bool`) instead of falling back to `str` (∉ the boolean type set), which had made Node-RED snap to
  the first list entry (`store`) and render the empty dropdown + `…`-expand. Fixed at two sites because
  not every node delegates to the shared helper: (1) the central `installBaseFields`/`applyBaseFields`
  in `resources/lib/editor-common.js`; (2) the **10 view nodes that manage `disabled`/`visible`
  inline** without calling the helpers — `ui-button, ui-checkbox, ui-datepicker, ui-input, ui-radio,
  ui-select, ui-slider, ui-switch, ui-textarea` (`disabled`) and `ui-skeleton` (`visible`). Clean
  boolean control across all nodes; sampled ui-list/ui-pagination/ui-button/ui-text.
- **save-semantics preserved (critical):** an empty/untouched `visible`/`disabled` still stores
  **`null`** — it must NOT synthesize a `{kind:literal,value:false}` (for `visible`, implicit default
  is `true`, so a stored literal-`false` would hide elements by default). The default *type* is `bool`
  for display; the *value* is only persisted when actually set. Explicitly setting `visible=true`
  stores `{kind:literal,value:true}`.
- **stats:** 12 files (editor-common.js + 10 view HTML + base-fields.spec.ts); +6 E2E cases
  (`tests/e2e/nodes/editor/base-fields.spec.ts`, 19 in file). Develop verification: `pnpm build`
  exit 0; full unit **1632 passed**; **base-fields E2E 19/19 green** (incl. empty→single boolean
  control / no store-`…`, untouched→null, explicit-true→bool literal). lint + validate + tripwires OK.
- **notes:** **Orchestrator recovery + follow-up fix.** (a) The original sub-agent died mid-task
  without committing; recovered from its worktree (decision: the 10 inline-node HTML edits are
  **required**, not scope-creep — those nodes don't delegate to installBaseFields, so the central fix
  alone wouldn't reach them). (b) Authoritative develop E2E then caught a **real save-semantics
  regression** — untouched `visible` persisted a synthetic literal-`false`; root cause was a fragile
  init-firing `change` listener clearing the "touched" flag (the bool typedInput normalises empty→
  `"false"` and fires a programmatic `change` on init). Fixed on `fix/P181-untouched-null` by dropping
  that listener and guarding the save so an originally-empty field whose result is the synthetic
  default → `null`. Re-verified green.
- **pre-existing reds (NOT from this phase, owner FYI):** the full E2E suite has 2 failures that are
  red at the pre-wave tip `0f04672` too — `p67-alert-binding` (canonical value set now includes
  `prop` globally, from the Components P177–P179 wave → **P182** is the fix) and `ui-action-verbs`
  (an accordion section renders `open` initially when it shouldn't — separate latent defect, filed).
- **cost:** sub-agent agent-ad283f992b6c3589d (died) → recovery agent-a1fda9cc391a0e2c0 (~8m) →
  fix agent-aeb9ed2f0e0094124 (~6m); + orchestrator full-suite gate + pre-wave bisect.
