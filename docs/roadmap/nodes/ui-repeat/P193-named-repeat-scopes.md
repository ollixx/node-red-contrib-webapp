---
id: P193
node: ui-repeat
epic: nodes/ui-repeat
title: "Benannte Repeat-Scopes: ui-repeat itemName (Alias) + item/index optional scope-qualifiziert → äußeres Repeat-item bei Verschachtelung adressierbar (ADR 0023)"
findings:
  - "Owner (2026-06-19): 'Wie komme ich an das item eines übergeordneten ui-repeats, wenn die geschachtelt sind?' — heute gewinnt der innerste item-Frame, die äußere Ebene ist nicht adressierbar (Offener Punkt der ui-repeat-Spec)."
  - "Owner-Entscheidung (2026-06-19): benannte Scopes/Alias (v-for-Modell) statt Ebenen-Qualifizierer."
acceptance:
  - "ui-repeat-Schema trägt optionales `itemName` (Alias-String); leer = nur das generische item/index (innerstes, unverändert)."
  - "item/index-Binding trägt optionales `scope` (= ein Repeat-Alias): {kind:item, scope:'customer', path:'name'} löst gegen das mit 'customer' benannte Repeat auf — unabhängig von dazwischenliegenden inneren Repeats; {kind:item, path:'name'} bleibt = innerstes."
  - "Renderer: jeder Scope-Frame trägt den itemName seines Repeats; eine scope-qualifizierte Bindung löst gegen den NAMENS-Frame im Stack auf, eine unqualifizierte gegen den obersten (wie heute)."
  - "Editor: die Aliase ALLER umschließenden benannten Repeats erscheinen als Binding-Typen (z. B. 'customer (Repeat)') mit Pfadfeld — gegated wie P182 (nur im Scope sichtbar); unbenannte Repeats tragen nur das innerste item/index bei."
  - "Verschachtelt nachweisbar: outer ui-repeat itemName='customer', inner itemName='order'; ein ui-text tief drin zeigt via 'customer.name' das äußere und via 'order.total' das innere Item (je Instanz-Kombination korrekt)."
  - "Rückwärtskompatibel: ohne itemName identisches Verhalten wie heute; generisches item/index = innerstes."
verify: browser
spec: docs/nodes/display/ui-repeat.md
tests: tests/e2e/nodes/view/ui-repeat.tests.md
dependencies: [P192]
status: in_progress
---
# P193 — Benannte Repeat-Scopes

> Setzt [ADR 0023](../../../adr/0023-named-repeat-scopes-for-nested-item-addressing.md)
> um: ein `ui-repeat` kann seinen Scope **benennen** (`itemName`), und `item`/
> `index` können einen **Alias** referenzieren → die äußere Ebene bei
> verschachtelten Repeats ist adressierbar. **Braucht P192** (Scope muss erst alle
> Nachfahren erreichen).

## Umfang (gespiegelt von ADR 0017/P182)

1. **Schema:** `ui-repeat.itemName` (optionaler Alias-String); `item`/`index`-
   Binding um optionales `scope` (Alias) erweitern — Form-Validierung
   (`contracts.ts`).
2. **Renderer:** Scope-Frame trägt `name = itemName`; scope-qualifizierte
   `item`/`index` lösen gegen den **Namens-Frame** im Stack auf, unqualifizierte
   gegen den obersten (heutiges Verhalten). Kein Treffer → `undefined` (+ Hinweis).
3. **Editor:** die Ancestry-Logik aus P182 (`mountIsInsideRepeat`) erweitern, um
   die **Aliase** aller umschließenden benannten Repeats zu sammeln; je Alias ein
   Binding-Typ („`<alias>` (Repeat)") mit Pfadfeld, gegated wie P182; Hinweis-/
   Validierungs-Logik aus [[P189]] mitziehen (leer = ganzes Element des Alias).
4. **Spec/Tests:** ui-repeat-Spec (`itemName` + scope-qualifizierte Bindung,
   Nested-Beispiel) — der „Offene Punkt äußere Ebene" wird geschlossen; editor.md
   §Scope-lokal um die benannten Typen ergänzen; E2E mit zwei verschachtelten
   benannten Repeats.

## acceptance / verify

- `verify: browser` — outer `customer` × inner `order`: ein tief verschachtelter
  ui-text zeigt äußeres + inneres Item korrekt. E2E im Haupt-Checkout durch den
  Orchestrator ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- **Namens-Kollisionen:** zwei umschließende Repeats mit demselben `itemName` →
  Editor-/Validierungs-Hinweis; Auflösung = nächst-höherer gleichnamiger Frame
  (oder Fehler — im Paket festlegen).
- **Reihenfolge:** nach P192 (Scope-Propagation) bauen; Editor-Teil baut auf P182
  + P189 auf.
- Reactive-Integration ([[P185]]) der benannten Scopes ist **Folgearbeit**, nicht
  hier.
