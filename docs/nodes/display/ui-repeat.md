# `ui-repeat`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.
>
> Begründendes ADR: [0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md).

## Zweck

`ui-repeat` rendert einen **Kind-Subtree n-fach aus Daten**. Der Knoten ist an
eine Liste (oder ein Objekt) gebunden (`items`); der Renderer **klont die
Schablone** — die Kinder im Default-Slot — einmal pro Element. Jede Instanz
bekommt einen **Render-Zeit-Scope** mit dem aktuellen Element, gegen den die
Kinder über die Binding-Art `item` / `index` **relativ** binden.

Anders als `ui-list` (Blatt-Widget mit festem `{id,label,value,icon}`-Schema und
Listen-Optik) trägt `ui-repeat` **keine Chrome** und wiederholt einen
**beliebigen** Subtree. Die beiden stehen bewusst nebeneinander (ADR 0017, Q1).

## Einordnung

- **Parent:** ein Slot eines `ui-app`-, `ui-route`-, `ui-dialog`- oder
  `ui-container`-Knotens. Deklariert über `mount` oder `parent`.
- **Kinder:** **ja** — der **Default-Slot** (`content`, `REPEAT_SLOT`) hält die
  Schablone (ein oder mehrere Knoten). Diese Kinder werden **pro Item** geklont.
- **Eigenes content-Layout (P191):** wie `ui-container`/`ui-route` trägt `ui-repeat`
  ein **eigenes Layout-Preset** für seinen `content`-Slot (`layoutId`). Die je Item
  geklonten Kinder werden in die **Regionen dieses Layouts** platziert — ihre
  Placement-Felder (`order`/`row`/`col`/`colSize`) greifen entsprechend dem Preset
  (horizontal/vertical/grid/absolute). Das ist eine **andere Rolle** als die
  Platzierung von `ui-repeat` **im Parent** (`layoutX`/`layoutY` + Placement):
  Kind-Platzierung vs. eigenes content-Layout sind sauber getrennt.
- **Rolle zur Laufzeit:** der Renderer löst `items` auf, iteriert, schiebt pro
  Element `{item, index}` auf den Scope, rendert die geklonte Schablone (in die
  Regionen des content-Layouts), poppt.

## Felder

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename. Default: `Repeat N`. |
| `mount` | „Parent Slot" | Mount-Picker | **ja** | Mount-Ziel als `<type>:<id>/<slot>`. |
| `layoutId` | „Child Layout" | Layout-Selektor | **ja** (default-migriert) | **Eigenes Layout-Preset für den `content`-Slot** (P191) — exakt wie `ui-container`. Die je Item geklonten Kinder werden in die Regionen dieses Layouts platziert; ihre Placement-Felder greifen gemäß Preset. Verstecktes `#node-input-layoutId` + `#node-input-layout-preset` via `installLayoutSelector`. Ein Altflow ohne `layoutId` migriert auf das Default-Preset (`vertical`) — kein roter Pflichtfeld-Bruch. |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `items` | „Items" | typedInput (Wert-Binding) | **ja** | Die zu iterierende Collection. Bindbar über alle Wert-Binding-Arten (literal/state/query/store/routeParam/reactive/msg/flow/global/jsonata/env). Auflösung zu einem **Array**; ein **Objekt** wird als Einträge `{key, value}` iteriert. Reaktiv: Änderung → Re-Render. |
| `keyField` | „Key-Feld" | Textfeld | optional | Feldname im Element, der als **stabiler Key** dient (z. B. `id`). Fehlt er, ist der Key der Array-Index. Steuert das keyed Morphing (Fokus/Scroll-Erhalt). |
| `itemName` | „Scope Name" | Textfeld | optional | **Alias für den Item-Scope dieses Repeats** (P193, [ADR 0023](../../adr/0023-named-repeat-scopes-for-nested-item-addressing.md)) — das `v-for="customer in customers"`-Modell. Gesetzt (z. B. `customer`) → ein Nachfahre adressiert das Element **dieses** Repeats **namentlich**, auch über innere Repeats hinweg, via die Binding-Art `Item (<alias>)` / `Index (<alias>)`. Leer = nur das generische innerste `item`/`index` (heutiges Verhalten, rückwärtskompatibel). Muss ein Identifier sein (`[a-zA-Z_$][a-zA-Z0-9_$]*`). |

## Item-Scope (Binding-Art `item` / `index`)

Innerhalb der Schablone binden Kinder **relativ zum aktuellen Element**:

- `item` → das ganze aktuelle Element; `item.<pfad>` → ein Feld (z. B.
  `item.name`, `item.address.city`).
- `index` → die nullbasierte Position.

Der Scope ist **Render-Zeit** (wie `routeParam`) — **keine** Persistenz, **kein**
Store-Nebeneffekt. **Außerhalb** eines `ui-repeat` löst `item`/`index` zu
`undefined` auf und ist ein im Editor prüfbarer Fehlgebrauch.

### Im Editor (P165)

- Die Wert-typedInputs der Kinder bieten die Binding-Arten **„Item (Repeat)"**
  (optionaler Feldpfad, z. B. `name`, `address.city`) und **„Index (Repeat)"**
  (pfadlos) an — am Ende des kanonischen Wert-Bindings-Sets, damit die bestehende
  Reihenfolge der globalen Arten unverändert bleibt.
- Wählt ein Kind `item`/`index`, **ohne** (transitiv) in einem `ui-repeat` zu
  hängen, zeigt der Editor einen **sichtbaren Hinweis** (nicht deploy-blockierend):
  die Bindung löst zur Render-Zeit zu `undefined` auf.

#### Das Wertfeld bei Typ „Item (Repeat)" / „Prop (Component)" (P189)

- Bei Typ **„Item (Repeat)"** ist das Wertfeld der **Feldpfad NACH `item.`** — der
  `item.`-Präfix **ist** der Typ. **Leer = das ganze Element** (ein Primitive wird
  direkt gebunden); `name`, `address.city` liest ein Feld. Wer `item` als *Wert*
  tippt, meint das Feld `item.item` (existiert i. d. R. nicht → `?`). Das Editor-
  Wertfeld zeigt dazu einen Inline-Hinweis „Feldpfad … **leer = ganzes Element**".
  „Prop (Component)" verhält sich analog (leer = ganze Prop); „Index (Repeat)" ist
  **pfadlos** (nullbasierte Position).
- **Typ-bewusste Validierung:** ein **leeres** Wertfeld ist bei `item`/`index`/`prop`
  **gültig** (whole-element / bare-index / whole-prop, konsistent zur Schema-Toleranz
  in P184) und markiert den Knoten **nicht** rot. Daten-Binding-Arten
  (`state`/`query`/…) verlangen weiterhin einen nicht-leeren Pfad. Das frühere
  typ-blinde `required: true` am Binding-Trägerfeld ist durch eine an den gewählten
  Binding-Typ delegierende Validierung ersetzt (gemeinsamer Editor-Helfer).

### Benannte Scopes (P193 / ADR 0023)

Bei **verschachtelten** `ui-repeat`s gewinnt für das generische `item`/`index`
weiterhin der **innerste** Frame. Um eine **äußere** Ebene zu erreichen, **benennt**
ein Repeat seinen Scope über `itemName` (z. B. `customer`):

- Ein `item`/`index`-Binding trägt optional einen `scope`-Qualifizierer (= ein
  Repeat-Alias). `{kind:"item", scope:"customer", path:"name"}` löst gegen das mit
  `customer` benannte Repeat auf — **unabhängig** von dazwischenliegenden inneren
  Repeats. `{kind:"item", path:"name"}` (ohne `scope`) bleibt = **innerstes**.
- Der Renderer hält einen **Stapel benannter Frames**; jeder Frame trägt den
  `itemName` seines Repeats. Eine scope-qualifizierte Bindung löst gegen den
  **nächst-höheren gleichnamigen** Frame auf (ein innerer gleichnamiger Repeat
  **überschattet** einen äußeren); kein Treffer → `undefined` (greift den
  `fallback`, sonst `?`) — **kein** Wurf.
- **Im Editor:** die Aliase **aller umschließenden benannten** Repeats erscheinen
  als eigene Binding-Arten **„Item (<alias>)"** / **„Index (<alias>)"** — gegated
  wie die scope-lokalen Arten (P182, nur im Scope sichtbar). Unbenannte umschließende
  Repeats tragen **keine** benannte Art bei (nur das generische innerste `item`/
  `index`). Eine bereits gespeicherte benannte Art bleibt sichtbar, auch wenn der
  Mount sie nicht mehr umschließt (kein stilles Verwerfen).
- **Beispiel (nachweisbar):** outer `ui-repeat itemName="customer"`, inner
  `ui-repeat itemName="order"`; ein tief verschachtelter `ui-text` zeigt via
  `Item (customer) → name` das **äußere** und via `Item (order) → total` (oder
  bare `Item (Repeat)`) das **innere** Element — je Instanz-Kombination korrekt.
- **Rückwärtskompatibel:** ohne `itemName`/`scope` identisches Verhalten wie heute.

### Basis-Felder (P139 / ADR 0015)

`ui-repeat` ist ein Template-Container: **`visible`** ist anwendbar;
**`disabled`** (kein interaktiver Zustand), **`color`** und **`size`** (keine
eigene Chrome) sind **N/A** und werden mit Hinweis deaktiviert angezeigt.

## Identität / Keys

Eine wiederholte Kind-Knoten-ID ist nicht mehr eindeutig. Der Renderer bildet
einen **stabilen Per-Instanz-Key = `itemKey × childId`** (`itemKey` aus
`keyField`, sonst Index) und speist damit das bestehende keyed Morphing.

## Input / Wire-Pfad

Wie bei `ui-list`: `msg.payload` (Array) **setzt `items`** und löst einen frischen
Snapshot an die Clients aus. **Kein** Message-Fan-out an die Kind-Knoten — die
„einzeln"-Zustellung ist die **Render-Iteration**, nicht ein Wire-Split (UI-Kinder
sind gemountet, nicht verdrahtet). `msg.ui.patch` überschreibt Felder.

## Besonderheiten / Grenzen

- **Stufe 1 ist read-only.** Anzeigen aus `item.*` zuerst. **Schreiben** aus einer
  Zeile (z. B. `ui-input` → `item.name` → `items[i].name`) braucht ein
  item-relatives Schreibziel und ist als **Stufe 2** zurückgestellt (ADR 0017 §5).
- **Per-Client** wie der übrige Baum (P15).
- `ui-list` bleibt unangetastet und ist **kein** Zucker über `ui-repeat`.

## Renderer-Verhalten (P164)

Der Renderer setzt den Vertrag oben um (Snapshot-Ebene; der Browser-Beweis ist
P165):

- **Klon-Zahl:** Array → `n` Klone (`n` = Länge); leeres Array / Skalar → **0**
  Klone (kein Crash). Objekt → ein Klon pro **eigener** Eigenschaft, in
  Einfügereihenfolge, mit `item = {key, value}`.
- **Scope-Auflösung:** `item` (ganzes Element), `item.<pfad>` (ein-/mehrstufig)
  und `index` (nullbasiert) lösen gegen den **innersten** aktiven Frame auf.
  `item` ohne Pfad auf ein Objekt-Element ist kein anzeigbarer Skalar → `"?"`
  (P104), wirft aber **nicht**. Außerhalb eines Repeats → `undefined` (greift den
  `fallback` der Bindung, sonst `"?"`) — **kein** Wurf.
- **Per-Instanz-Id:** `<itemKey>#<childId>` mit `itemKey` aus `keyField` (sonst
  Objekt-Eintrags-`key`, sonst Index). Diese Id wird vom Serializer als
  `data-webapp-node` gestempelt und speist das bestehende keyed Morphing; bei
  Reorder/Insert/Delete bleiben die Ids der unveränderten Instanzen stabil.
- **Reaktiv:** Änderung der `items`-Quelle (Store/Query) → frischer Snapshot mit
  korrekter Instanzzahl.
- **Verschachtelung:** Der Scope ist ein **Stapel** — der innerste Frame gewinnt
  für `item`/`index`. Verschachtelte Repeats expandieren rekursiv; die
  Per-Instanz-Ids verketten beide Ebenen (`<aussenKey>#<innenKey>#<childId>`),
  kollisionsfrei. Eine **explizite** Benennung der äußeren Ebene ist über
  `itemName` + scope-qualifizierte `item`/`index`-Bindings möglich (P193, ADR 0023 —
  s. „Benannte Scopes").
- **Scope durch Kind-tragende Knoten (P192):** Der Item-Scope erreicht **nicht nur
  die direkten** Template-Kinder, sondern propagiert durch **jeden Kind-tragenden
  Knoten** im Template — `ui-container`, `ui-tabs`/`ui-tab`,
  `ui-accordion`/`ui-accordion-section` (sowie verschachtelte `ui-repeat` und
  `ui-component-instance`). Der Renderer klont das **gesamte Template-Subtree** je
  Item: Scope **und** die Per-Instanz-Re-Id (`<itemKey>#…`) propagieren über die
  jeweilige Mount-Konvention bis zu den Blättern, sodass ein `ui-text` mit
  `item.<feld>`/`index` **innerhalb** eines Containers (Tab, Accordion-Section …)
  im Repeat gegen das Element des **nächst höheren** Repeats auflöst — je Instanz
  unterschiedlich. Die geklonten Container und alle Nachfahren tragen den
  `<itemKey>#…`-Präfix konsistent, sodass innere Mounts **innerhalb** des Klons
  auflösen (kein Verweis aufs Original) und das keyed Morphing stabil bleibt.
  Strukturknoten (`ui-app`/`ui-route`/`ui-dialog`) sind **keine** Repeat-Kinder
  (top-level gemountet) und damit außerhalb dieses Scopes.

## Offene Punkte

- ~~Verschachtelte `ui-repeat`: explizite **Benennung der äußeren Ebene**~~ —
  **gelöst** (P193, ADR 0023): `itemName`-Alias + scope-qualifizierte `item`/`index`
  (s. „Benannte Scopes"). Reaktive Integration der benannten Scopes ([[P185]]) ist
  Folgearbeit.
- Schreiben aus der Zeile (Stufe 2): item-relatives Schreibziel + Input/Store-
  Vertrag im Repeat.
- Leerzustand (kein Item) — Zusammenspiel mit `ui-empty-state` ([[P152]]).

## Referenzen

- [ADR 0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md)
- [ADR 0023](../../adr/0023-named-repeat-scopes-for-nested-item-addressing.md) — benannte Repeat-Scopes (`itemName` + scope-qualifizierte `item`/`index`)
- [stores.md](../concepts/stores.md) — Wert-Binding-Arten für `items`
- [reactive-expressions.md](../concepts/reactive-expressions.md)
