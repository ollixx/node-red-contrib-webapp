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
- **Kinder:** **ja** — der **Default-Slot** hält die Schablone (ein oder mehrere
  Knoten). Diese Kinder werden **pro Item** geklont.
- **Rolle zur Laufzeit:** der Renderer löst `items` auf, iteriert, schiebt pro
  Element `{item, index}` auf den Scope, rendert die geklonte Schablone, poppt.

## Felder

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename. Default: `Repeat N`. |
| `mount` | „Parent Slot" | Mount-Picker | **ja** | Mount-Ziel als `<type>:<id>/<slot>`. |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `items` | „Items" | typedInput (Wert-Binding) | **ja** | Die zu iterierende Collection. Bindbar über alle Wert-Binding-Arten (literal/state/query/store/routeParam/reactive/msg/flow/global/jsonata/env). Auflösung zu einem **Array**; ein **Objekt** wird als Einträge `{key, value}` iteriert. Reaktiv: Änderung → Re-Render. |
| `keyField` | „Key-Feld" | Textfeld | optional | Feldname im Element, der als **stabiler Key** dient (z. B. `id`). Fehlt er, ist der Key der Array-Index. Steuert das keyed Morphing (Fokus/Scroll-Erhalt). |

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
  kollisionsfrei. Eine **explizite** Benennung der äußeren Ebene ist Folgearbeit
  (s. Offene Punkte).
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

- Verschachtelte `ui-repeat`: explizite **Benennung der äußeren Ebene** (heute
  gewinnt der innerste `item`/`index`-Frame; eine äußere Ebene ist nicht direkt
  adressierbar).
- Schreiben aus der Zeile (Stufe 2): item-relatives Schreibziel + Input/Store-
  Vertrag im Repeat.
- Leerzustand (kein Item) — Zusammenspiel mit `ui-empty-state` ([[P152]]).

## Referenzen

- [ADR 0017](../../adr/0017-ui-repeat-template-container-render-time-scope.md)
- [stores.md](../concepts/stores.md) — Wert-Binding-Arten für `items`
- [reactive-expressions.md](../concepts/reactive-expressions.md)
