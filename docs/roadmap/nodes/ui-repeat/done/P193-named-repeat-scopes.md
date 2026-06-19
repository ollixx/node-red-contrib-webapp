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
status: done
---
# P193 — Benannte Repeat-Scopes

> Setzt [ADR 0023](../../../../adr/0023-named-repeat-scopes-for-nested-item-addressing.md)
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

## Result

- **delivered:** Named repeat scopes (ADR 0023, the v-for alias model) — the **outer** repeat level is
  now addressable from a nested repeat. Schema: `ui-repeat.itemName` alias + an optional `scope`
  qualifier on `item`/`index` bindings (`contracts.ts`, `node-definitions.ts`); `scope` is rejected on
  non-item/index kinds. Backward compatible: no `itemName` / no `scope` → today's innermost behaviour.
  Renderer: `ItemScopeFrame.name` + `selectItemFrame` (nearest matching named frame; inner shadows
  outer), and EVERY repeat — including the tabs/accordion section-repeat path — stamps its alias onto
  the pushed frame. Editor: `collectEnclosingRepeatAliases` (gated the P182 way), `valueBindingTypes`
  offers `Item (<alias>)` / `Index (<alias>)`, apply/readValueBinding round-trip the scope-qualified
  binding, and `ui-repeat.html` gains a "Scope Name" field + help. Spec updated (named-scopes section;
  the ADR 0023 nested open-point is closed). Consumed P182/P184/P185/P192 machinery — all verified
  present, none reimplemented.
- **stats:** 13 files (+994/−15); new tests — schema 13, renderer 4, editor 20, +1 E2E + fixture.
  Develop verification: build exit 0; full unit **1743** (schema 377, editor 172, renderer 145, runtime
  1049); **ui-repeat E2E 10/10 green** incl. the new P193 nested-named proof (a nested child reads the
  OUTER `customer` by alias and the INNER `order` by alias/bare → `Ada,10,10 / Ada,20,20 / Linus,30,30`);
  check:specs + check:links + check:roadmap + lint green.
- **notes:** The sub-agent **ran the E2E green in-worktree** (10 passed) rather than only `--list`-
  parsing it — and itself found + fixed the same class of `mapConfig` drop bug seen in P191/P192 (both
  ui-repeat mapping paths now carry `itemName` into the model; without it the inner repeat rendered
  empty). Reactive integration of named scopes (P185 × aliases) is explicitly follow-up. With P190/P191/
  P193 all landed, the P195 `check:specs` follow-up (reconcile the ui-repeat spec field-table + drop it
  from the allowlist) is now actionable.
- **cost:** session agent-acf4f12f6a15fe797, ~30m.
