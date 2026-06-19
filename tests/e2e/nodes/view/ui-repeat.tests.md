# Testkatalog: ui-repeat

> Format gemäß `.ai/agents/node-testing.md`. Angelegt mit der Planung der
> ui-repeat-Welle (ADR 0017) und in P163–P165 zu befüllen.

## Geplante Testziele

### Schema + Binding-Art `item`/`index` (P163) — abgedeckt (unit)

> Umgesetzt in `packages/schema/test/p163-repeat-item-binding.test.ts`
> (`verify: unit`). Kein E2E-Spec in dieser Schicht.

- `ui-repeat`-Knotendefinition validiert (`items` Pflicht-Wert-Binding,
  optionales `keyField`, fester Default-Slot `content` = `REPEAT_SLOT`). Negativ:
  fehlende `items` und leeres `keyField` bleiben rot; Knoten ohne `mount`/`parent`
  rot.
- Binding-Art `item` (ganzes Element), `item.<pfad>` (ein-/mehrstufig, z. B.
  `address.city`) und `index` (nullbasiert, pfadlos) ist im Binding-Union
  zugelassen, **scope-lokal** markiert und schema-validierbar; `item.<pfad>`
  roundtrippt durch parse/serialize. Negativ: unbekannte Binding-Art bleibt rot;
  `index` mit Pfad und malformierte `item`-Pfade (führender/Doppel-Punkt) rot.
- Fixtures: `itemBindingFixture`, `indexBindingFixture`,
  `minimalRepeatNodeSetFixture` (Array-Quelle + Kind mit `item.name`).

### Renderer — Template-Klon + Render-Zeit-Scope (P164) — abgedeckt (unit)

> Umgesetzt in `packages/renderer/test/p164-repeat-template-clone.test.ts`
> (`verify: unit` — diese Snapshot-Tests SIND die Akzeptanz dieser Schicht). Der
> Browser-Beweis des Gesamt-Flows liegt in P165.

- `items`-Array → die Schablone wird n-mal geklont (n = Array-Länge); leeres Array
  / Skalar → 0 Klone (kein Crash); Objekt → Iteration als `{key,value}`
  (`item.key` / `item.value`).
- `item.<pfad>` (ein-/mehrstufig, z. B. `address.city`) in einem Kind löst gegen
  das aktuelle Element auf; `index` gegen die Position; verschiedene Instanzen
  zeigen verschiedene Werte. Bare `item` auf ein Objekt → `"?"` (P104), kein Wurf.
- `item`/`index` **außerhalb** eines Repeats → `undefined` (greift `fallback`,
  sonst `"?"`; kein Crash).
- Keyed Morphing: Per-Instanz-Id `<itemKey>#<childId>` (Key = `keyField`-Wert,
  sonst Objekt-Eintrags-`key`, sonst Index) bleibt bei Umsortieren/Einfügen/Löschen
  für unveränderte Instanzen stabil — speist das bestehende keyed Morphing
  (Fokus/Scroll-Erhalt wird im Browser in P165 bewiesen).
- Reaktiv: Änderung der `items`-Quelle (Store via `replaceState`, Query via
  `replaceQueries`) → frischer Snapshot mit korrekter Instanzzahl.
- Verschachtelte Repeats: Scope-Stapel, innerster Frame gewinnt; Ids verketten
  beide Ebenen kollisionsfrei (`<aussenKey>#<innenKey>#<childId>`).

### Editor + Node-Registrierung (P165, browser) — abgedeckt

> Browser-Beweis: `tests/e2e/nodes/view/ui-repeat.spec.ts`
> (Fixture-Flow `tests/e2e/fixtures/ui-repeat.flow.json`). Editor-Unit-Coverage:
> `packages/editor/test/p113-value-binding-types.test.ts` (item/index als
> Wert-Binding-Arten am Ende des Sets; Serialisierung/Roundtrip) +
> `packages/editor/test/node-set.test.ts` (`ui-repeat` im Editor-Node-Set).

- **Registrierung:** `ui-repeat` ist registriert (`nodes/view/ui-repeat.{js,html}`,
  `package.json` `node-red.nodes`, `WEBAPP_NODE_TYPES`, `runtimeNodeRegistry`,
  Komponenten-Filter). Im Editor anlegbar; `items`-typedInput (Wert-Binding) +
  `keyField`-Textfeld + Mount-Picker sichtbar.
- **Default-Slot:** der Knoten erscheint als Container in beiden Mount-Pickern
  (`buildMountOptionsTree` / `buildMountPickerTree`); Kinder mounten via
  `container:<id>/content` (REPEAT_SLOT). Im Fixture-Flow mountet `ui-text` in
  `container:peopleRepeat/content`.
- **item/index im Editor:** die Wert-typedInputs bieten „Item (Repeat)" (opt.
  Pfad) + „Index (Repeat)" (pfadlos); Serialisierung `item`→`{kind:item,path}`,
  `index`→`{kind:index,path:""}` und Roundtrip (Unit). `installRepeatScopeHint`
  warnt sichtbar, wenn `item`/`index` außerhalb eines Repeats genutzt wird (an
  `ui-text` verdrahtet).
- **End-to-End (browser):** Store-Array `[{name:'A'},{name:'B'}]` + `ui-repeat`
  (an Store gebunden) mit `ui-text`-Kind (`value = item.name`) rendert zwei
  Zeilen `A`, `B`. Klick auf „Add third" (Store-`replace` mit 3-Element-Array)
  rendert sichtbar eine dritte Zeile `C`; **keyed** (`keyField:"name"`) — die
  vorhandene `A`-Zeile (Per-Instanz-Id `A#personName`) behält ihren DOM-Marker
  über das Morph hinweg (kein Re-Mount).

### Scope-lokale Bindings mit leerem Pfad (P184) — abgedeckt

> Bugfix: whole-`item` (String-Element) und `index` wurden mit `path:''`
> serialisiert/validiert und fälschlich abgelehnt. Unit:
> `packages/schema/test/p163-repeat-item-binding.test.ts`
> (Schema akzeptiert item/index/prop mit leerem Pfad; `path:''`-Altflows
> toleriert; Negative bleiben rot) +
> `packages/renderer/test/p164-repeat-template-clone.test.ts`
> (whole-`item` + `index` über ein String-Array) +
> `packages/editor/test/p113-value-binding-types.test.ts`
> (Serialisierung lässt den leeren Pfad weg). Browser:
> `tests/e2e/nodes/view/ui-repeat.spec.ts`
> (Fixture `tests/e2e/fixtures/ui-repeat-primitive.flow.json`).

- **Schema:** `{kind:'item'}` / `{kind:'index'}` / `{kind:'prop'}` ohne Pfad gültig;
  ein gespeichertes `path:''` auf item/index/prop validiert wie „kein Pfad"
  (Migration ohne Re-Save). Negativ: `index` mit echtem Pfad, malformierter
  `item`-Pfad und ein leerer Pfad auf Daten-Kinds (state/query) bleiben rot.
- **Editor:** `applyValueBinding` speichert whole-`item`/`index`/`prop` OHNE
  `path`-Schlüssel (leerer Pfad weggelassen); ein item-Feldpfad bleibt erhalten.
- **End-to-End (browser):** Store-Array `["alpha","beta","gamma"]` + `ui-repeat`
  mit zwei `ui-text`-Kindern (`value = item` ganzes Element, `value = index`
  nullbasiert) rendert die interleaved Sequenz `alpha,0, beta,1, gamma,2` —
  ganzes String-Element und Position lösen ohne Validierungsfehler auf.

### Editor-UX + typ-bewusste Validierung des Pfadfelds (P189) — abgedeckt

> Editor-Entsprechung zu P184 (Owner 2026-06-19): das Wert-typedInput trägt für
> die scope-lokalen Kinds einen **Pfad-Hinweis** („Feldpfad … leer = ganzes
> Element"), und die Validierung des Binding-Trägerfelds ist **typ-bewusst** —
> ein leeres `item`/`index`/`prop`-Pfadfeld ist gültig (whole-element / bare-index
> / whole-prop, wie P184), während Daten-Kinds (state/query/…) weiterhin einen
> nicht-leeren Pfad verlangen. Das blunt `required: true` am Binding-Feld ist durch
> den gemeinsamen Helfer `validateValueBindingField` ersetzt. Unit:
> `packages/editor/test/p189-value-binding-validation.test.ts`
> (`isValueBindingValueValid`: item/index/prop leer = gültig, malformierter
> item-Pfad rot, query/store/state/Literal leer = rot). Browser:
> `tests/e2e/nodes/editor/p189-item-prop-path-field.spec.ts`.

- **Editor-Hinweis:** `installValueBindingPathHint` mountet unter dem Wert-Feld
  einen Hinweis, der nur bei Kind `item`/`prop` erscheint („Feldpfad … leer =
  ganzes Element/ganze Prop") bzw. bei `index` einen Mini-Hinweis („nullbasierte
  Position — kein Pfad"); für Daten-Kinds verborgen. An `ui-text`/`ui-button`
  verdrahtet.
- **Validierung typ-bewusst:** das Binding-Trägerfeld (`text`/`label`) delegiert
  via `validateValueBindingField("#node-input-…")` an den gewählten typedInput-Typ;
  `prop` mit leerem Pfad ist jetzt gültig (Angleich an `item`, P184-Vertrag).
- **End-to-End (browser):** in einem `ui-repeat` gemountetes `ui-text`: (a) Wechsel
  zu Kind `item` blendet den „leer = ganzes Element"-Hinweis ein, Kind `query`
  blendet ihn aus; (b) `item`-Feld leer → Knoten bleibt grün (`node.valid`),
  `index` leer → grün, `query` leer → rot, gefüllter `query`-Pfad → wieder grün.

### item/index/prop in Reactive-Expressions (P185) — abgedeckt

> Feature: `item`/`index` (und `prop`) sind INNERHALB einer Reactive-Expression
> mit korrektem PER-INSTANZ-Scope erreichbar; die Reactive-Autocomplete bietet sie
> im Repeat-/Component-Scope an. Unit:
> `packages/renderer/test/p185-item-index-in-reactive.test.ts`
> (Reactive `` `Zeile ${index}: ${item.name}` `` über ein Repeat → je Instanz
> eigener Wert; außerhalb eines Repeats `item`/`index` → `undefined`, kein Crash) +
> `packages/editor/test/p185-reactive-scope-globals.test.ts`
> (`reactiveScopeGlobals` bietet item/index nur im Repeat-, prop nur im
> Component-Scope; außerhalb nichts). Browser:
> `tests/e2e/nodes/view/ui-repeat.spec.ts`
> (Fixture `tests/e2e/fixtures/ui-repeat-reactive.flow.json`).

- **Renderer:** der Renderer injiziert beim Klonen je Instanz die eigenen
  `item`/`index`-Werte (bzw. `prop` aus dem Prop-Scope) in den Reactive-Eval-Scope;
  dieselbe kompilierte Expression liefert je Zeile ihr eigenes Ergebnis. Außerhalb
  eines Repeats/einer Component-Definition sind `item`/`index`/`prop` `undefined`
  (kein Wurf, konsistent mit den scope-lokalen Binding-Arten).
- **Editor-Autocomplete:** `reactiveScopeGlobals(ctx)` ergänzt die Globals-Liste
  und das Doku-Panel scope-abhängig um `item`/`index` (Repeat) bzw. `prop`
  (Component) — Gating wie bei den Binding-Arten (P182, via `currentEditorScope`).
- **End-to-End (browser):** Store-Array `[{name:'Ada'},{name:'Linus'},{name:'Grace'}]`
  + `ui-repeat` mit einem `ui-text`-Kind, dessen `value` ein Reactive-Binding
  `` `Zeile ${index}: ${item.name}` `` ist, rendert drei DISTINKTE Zeilen
  `Zeile 0: Ada`, `Zeile 1: Linus`, `Zeile 2: Grace` — der Beweis des Per-Instanz-
  Scopes (gleiche Expression, je Zeile eigener Wert).

### Item-Scope durch verschachtelte Container (P192) — abgedeckt

> Bugfix (Owner 2026-06-19): der Item-Scope erreichte nur die DIREKTEN
> Template-Kinder (+ nested repeat/component-instance). Ein Kind-tragender Knoten
> dazwischen (`ui-container`, `ui-tabs`/`ui-tab`, `ui-accordion`/`-section`) brach
> die Kette — dessen Kinder wurden vom allgemeinen Mount-Pass OHNE itemScope und
> ohne Re-Id gerendert → `item` undefined. Fix: `expandRepeat` klont das GANZE
> Template-Subtree je Item (Scope + Per-Instanz-Re-Id propagieren durch JEDEN
> Kind-tragenden Knoten über dessen Mount-Konvention). Unit:
> `packages/renderer/test/p192-repeat-scope-through-containers.test.ts`
> (ui-text mit `item.*` in ui-container, ui-tab, ui-accordion-section — je im
> ui-repeat — löst je Instanz auf; tiefe/gemischte Schachtelung; nested repeat:
> innerster Frame gewinnt; keine Regression bei direkten Kindern / 0-Item).
> Browser: `tests/e2e/nodes/view/ui-repeat.spec.ts`
> (Fixture `tests/e2e/fixtures/ui-repeat-container.flow.json`).

- **Renderer:** ein Kind-tragender Template-Knoten (ui-container, ui-tabs/ui-tab,
  ui-accordion/-section) propagiert Scope + Re-Id rekursiv an seine Kinder über die
  jeweilige Mount-Konvention (`container:`/`ui-tabs:`/`ui-tab:`/`ui-accordion:`/
  `ui-accordion-section:`) — Verallgemeinerung der zwei bisherigen Sonderfälle
  (nested repeat/component-instance), kein zweiter Render-Pfad. Geklonter Container
  UND alle Nachfahren tragen den `<itemKey>#…`-Präfix konsistent; innere Mounts
  lösen INNERHALB des Klons auf. Beliebige Tiefe/Mischung; verschachtelte Repeats:
  innerster Frame gewinnt. Strukturknoten (ui-app/ui-route/ui-dialog) sind keine
  Repeat-Kinder → außerhalb des Scopes. Keine Regression: direkte Kinder / 0-Item
  unverändert.
- **End-to-End (browser):** Store-Array `[{name:'Ada',city:'London'},{name:'Linus',
  city:'Helsinki'}]` + `ui-repeat` (keyed `name`) → `ui-container` (Layout
  horizontal) mit zwei `ui-text`-Kindern (`value = item.name` / `item.city`)
  rendert je Zeile die richtigen Werte (`Ada, London, Linus, Helsinki`); die Kinder
  im geklonten Container tragen den Per-Instanz-Marker (`Ada#rowName`,
  `Ada#rowCity`, `Linus#rowName`, `Linus#rowCity`) — der Beweis, dass Scope + Re-Id
  durch den Container propagieren.


### Eigenes content-Slot-Layout (P191) — abgedeckt

> Owner 2026-06-19: `ui-repeat` ist ein vollwertiger CONTAINER — sein `content`-Slot
> (REPEAT_SLOT) bekommt ein EIGENES Layout-Preset (wie `ui-container`'s `layoutId`).
> Die je Item geklonten Kinder werden in die Regionen dieses Layouts platziert, sodass
> ihre Placement-Felder (order/row/col/colSize) greifen — konform zu ui-container/ui-route.
> Schema: `packages/schema/test/p163-repeat-item-binding.test.ts` (optionales `layout`-Preset,
> Default-migrierbar; unbekanntes Preset rot). Renderer:
> `packages/renderer/test/p191-repeat-own-layout.test.ts` (je Item ein `container`-Komponente
> mit `layoutId` + `regions`; Kinder unter der Layout-Region mit Item-Scope; keyed
> `<itemKey>#<repeatId>`; 0-Item → 0 Container; OHNE layoutId → Legacy-Flach-Verhalten).
> Browser: `tests/e2e/nodes/view/ui-repeat.spec.ts`
> (Fixture `tests/e2e/fixtures/ui-repeat-layout.flow.json`).

- **Schema:** das `ui-repeat`-Knotenschema trägt ein OPTIONALES `layout`-Preset (wie
  ui-container, aber optional für Altflows); mapConfig migriert ein fehlendes Layout auf
  das Default-Preset (`vertical`) und mappt `layout || layoutId` → `props.layoutId`. Das
  referenzierte Layout wird in die `layouts`-Liste des Modells aufgenommen. Unbekanntes
  Preset bleibt rot.
- **Editor:** ein „Child Layout"-Selektor (verstecktes `#node-input-layoutId` +
  `#node-input-layout-preset`) — identisch zu ui-container via `installLayoutSelector`;
  ein leeres `layoutId` migriert beim Öffnen auf das erste Preset (kein roter
  Pflichtfeld-Bruch bei Altflows). `ui-repeat` bleibt zugleich Kind: layoutX/Y +
  Placement im Parent unverändert (zwei Rollen sauber getrennt).
- **Renderer:** `expandRepeat` platziert je Item die geklonten Kinder in die Regionen des
  Repeat-Layouts, indem es je Instanz eine `container`-Komponente
  (`id = <itemKey>#<repeatId>`, `layoutId`, `regions`) rendert (über
  `cloneTemplateSubtree` + `createContainerMountMatcher`, Wurzel = das Repeat). OHNE
  Layout bleibt das Legacy-Flach-Verhalten (P164) unverändert — keine Regression in
  p164/p192.
- **End-to-End (browser):** Store-Array `[{name:'Ada',city:'London'},{name:'Linus',
  city:'Helsinki'}]` + `ui-repeat` mit `layout:"grid"` und zwei direkten `ui-text`-Kindern
  (`item.name` / `item.city`) rendert je Item einen `webapp-container`
  (`Ada#gridRepeat` / `Linus#gridRepeat`), dessen Slot-Body den `--grid`-Modifier trägt;
  die Kinder (`Ada#gridName`, `Ada#gridCity`, …) sitzen INNERHALB ihres Per-Item-Containers
  und lösen `item.*` je Zeile auf.

### items-typedInput Carrier-id Round-trip Fix (P190) — abgedeckt

> Bug (Owner 2026-06-19): der items-typedInput lag auf `#node-input-items` (= gleiche id wie die
> Property `items`). Node-REDs Auto-Feld-Handling schrieb den rohen Feldwert in `this.items` →
> beim Wieder-Öffnen konnte `parseBindingValue` den raw String nicht als Binding lesen →
> Feld blieb leer. Fix: separater Träger `#node-input-itemsBinding` (Spiegel zu ui-list / P171).
> Browser: `tests/e2e/nodes/view/ui-repeat.spec.ts`
> (describe „ui-repeat items typedInput round-trip (P190)").

- **Editor:** `#node-input-itemsBinding` (NICHT `#node-input-items`) ist im Editor-Tray sichtbar
  (accept: `itemsBinding`-Default in den defaults, kein `#node-input-items`-DOM-Feld).
- **Round-trip:** ein items-Binding (Store-Binding) wird gespeichert; nach Schließen und
  Wieder-Öffnen des Editor-Panels sind `type` und `value` unverändert und nicht leer.

## Editor: Basis-Felder (P139, ADR 0015) — abgedeckt

- `ui-repeat` ist ein Template-Container: `visible` anwendbar; `disabled`,
  `color`, `size` N/A (mit Hinweis deaktiviert). Verdrahtet via `installBaseFields`
  / `applyBaseFields` (`BASE_FIELDS` in `nodes/view/ui-repeat.html`).

## Benannte Repeat-Scopes (P193, ADR 0023) — abgedeckt (unit + E2E)

> Schema: `packages/schema/test/p193-named-repeat-scopes.test.ts` —
> `ui-repeat.itemName` (optionaler Alias) validiert; `item`/`index` mit optionalem
> `scope`-Qualifizierer validieren; `scope` auf einer Nicht-`item`/`index`-Art
> bleibt rot; scoped-item roundtrippt durch parse/serialize.
> Renderer: `packages/renderer/test/p193-named-repeat-scopes.test.ts` —
> verschachtelte Repeats (outer `customer` × inner `order`): scoped
> `item:customer` löst die **äußere** Zeile, scoped `item:order` und bare
> `item` die **innere**; scoped `index` analog; unmatched scope → fallback (kein
> Wurf); innerer gleichnamiger Repeat überschattet den äußeren.
> Editor: `packages/editor/test/p193-named-repeat-scopes.test.ts` —
> `collectEnclosingRepeatAliases` sammelt umschließende benannte Aliase
> (nearest-first, unbenannte übersprungen, dedupliziert); `valueBindingTypes`
> bietet `Item (<alias>)` / `Index (<alias>)` je Alias (gegated wie P182, current
> kind re-included); `applyValueBinding`/`readValueBinding` roundtrippen die
> scope-qualifizierte Bindung; scoped-Typen validieren wie ihre bare-Art.

- **Browser:** `tests/e2e/nodes/view/ui-repeat.spec.ts`
  (describe „ui-repeat — outer item addressable by alias from a nested repeat (P193)").
  Fixture `tests/e2e/fixtures/ui-repeat-named-scope.flow.json`: outer
  `customerRepeat itemName="customer"` → inner `orderRepeat itemName="order"`
  (items = `item:customer.orders`) → drei `ui-text`: `item:customer.name` (äußere),
  `item:order.total` (innere), bare `item.total` (innerste == order). Ada (Orders
  10, 20) + Linus (Order 30) → interleavte Sequenz
  `Ada,10,10, Ada,20,20, Linus,30,30` beweist: der äußere Name wird je innerer
  Order korrekt wiederholt, die innere Summe variiert.

## Showcase-Spec (P187, ADR 0022 §2)

Pilot-Showcase-Spec: `tests/e2e/showcase/ui-repeat.showcase.spec.ts`

Abgedeckte Features in benannten `test.step`-Kapiteln (→ Kapitel im Trace/Video):
1. String-Array: whole-`item` + `index` → interleaved Sequenz (P184).
2. Objekt-Array: `item.name` löst je Klon auf (P165).
3. Keyed Update: drittes Element wird zugefügt; Ada und Linus behalten ihre per-instance-ids (P165).
4. Config-Dialog-Cameo: `#node-input-itemsBinding` (P190 fix — separater Träger) + `#node-input-keyField` im Editor-Tray.

Laufbar unter `SHOWCASE=1 pnpm exec playwright test tests/e2e/showcase/ui-repeat.showcase.spec.ts`.
