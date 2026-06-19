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

## Editor: Basis-Felder (P139, ADR 0015) — abgedeckt

- `ui-repeat` ist ein Template-Container: `visible` anwendbar; `disabled`,
  `color`, `size` N/A (mit Hinweis deaktiviert). Verdrahtet via `installBaseFields`
  / `applyBaseFields` (`BASE_FIELDS` in `nodes/view/ui-repeat.html`).

## Showcase-Spec (P187, ADR 0022 §2)

Pilot-Showcase-Spec: `tests/e2e/showcase/ui-repeat.showcase.spec.ts`

Abgedeckte Features in benannten `test.step`-Kapiteln (→ Kapitel im Trace/Video):
1. String-Array: whole-`item` + `index` → interleaved Sequenz (P184).
2. Objekt-Array: `item.name` löst je Klon auf (P165).
3. Keyed Update: drittes Element wird zugefügt; Ada und Linus behalten ihre per-instance-ids (P165).
4. Config-Dialog-Cameo: `#node-input-items` + `#node-input-keyField` im Editor-Tray.

Laufbar unter `SHOWCASE=1 pnpm exec playwright test tests/e2e/showcase/ui-repeat.showcase.spec.ts`.
