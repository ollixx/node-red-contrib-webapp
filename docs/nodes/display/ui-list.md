# `ui-list`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-list` rendert eine **strukturierte Liste** an einem Mount-Ziel. Die
Listenelemente werden über das `items`-Binding bereitgestellt — entweder als
statisches Array oder dynamisch aus State, Query oder Node-RED-Kontext. Jedes
Element ist ein **String** (Kurzform fürs Label) oder ein **Item-Objekt** mit
festem Schema (`id`/`label`/`value`/`icon`) — dieses Schema ist der **Vertrag
zwischen deinen Daten und der gerenderten Zeile** und in
[„Item-Schema — das Datenmodell"](#item-schema--das-datenmodell) exakt beschrieben.
Der visuelle Darstellungsmodus (`displayType`) steuert, ob die Liste standard,
geteilt oder kompakt erscheint. Optional ist die Liste **auswählbar**
(`selectable`, Single-Select). Nutzerinteraktionen (Klick, Auswahl) werden als
Events auf konfigurierten Output-Ports emittiert.

> **Stärke und Schwäche zugleich:** das Item-Schema ist fest. Der Autor muss seine
> Daten in genau diese Form bringen — ui-list macht **kein** implizites
> Feld-Mapping. Für beliebig reiche Zeilen ist `ui-repeat` (beliebiger Subtree
> pro Element) oder `ui-table` (Spalten) gedacht, nicht ui-list.

## Einordnung

- **Parent:** ein Slot eines `ui-app`-, `ui-route`-, `ui-dialog`- oder
  `ui-container`-Knotens. Deklariert über `mount` oder `parent`.
- **Kinder:** keine — `ui-list` ist ein Blatt-Knoten; die Zeilen werden durch
  das `items`-Binding deklarativ, nicht durch Child-Knoten, beschrieben.
- **Erreichbarkeit:** als Teil des gerenderten Snapshots der Parent-Route bzw.
  des Parent-Dialogs.
- **Rolle zur Laufzeit:** der Renderer löst `items` auf, normalisiert
  String-Kurzformen zu `{label}`, iteriert und erzeugt pro Element eine Zeile
  (Label + optionales Icon); `value` wird gemäß `displayValue`
  (`none`/`secondary`/`badge`) dargestellt. Bei `selectable` markiert er die über
  `selectedId` bestimmte Zeile als ausgewählt.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `List N`. |
| `mount` | „Parent Slot" | Mount-Picker (hierarchischer Baum) | **ja** | Mount-Ziel des Knotens. Auswahl aus dem Slot-Baum (`installReferenceSelectors({ mount: true })`). Gespeichert als Mount-Pfad `<type>:<id>/<slot>`. |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `items` | „Items" | typedInput (Wert-Binding, **eingeschränkt**) | **ja** | Array der Listenelemente. **Nur Typen, die ein valides Modell liefern können** — Skalar-Typen (`str`, `num`, `bool`) sind im typedInput **ausgeblendet**. Erlaubt: `json` (statisches Array direkt im Editor) sowie die Binding-Arten `state`, `query`, `routeParam`, `store` (Store-Picker), `msg`/`flow`/`global`/`jsonata`/`env`. Die **Form jedes Elements** ist in [„Item-Schema"](#item-schema--das-datenmodell) festgelegt. Binding-Arten: [stores.md](../concepts/stores.md). **Migration:** ein bestehendes `itemsPath` (nacktes Textfeld) wird als `state`-Binding auf `items` übernommen; das separate `itemsPath`-Feld entfällt. Mapping: ein führendes `state.` im alten Pfad wird abgezogen (`state.foo.bar` → `state`-Binding mit Pfad `foo.bar`), sonst der ganze String als State-Pfad — **kein** doppeltes `state.state.…`. |
| `displayType` | „Display Type" | SelectBox | optional | Darstellungsmodus der Liste: `default` (Standard-Liste ohne Trennlinie), `divided` (mit horizontalen Trennlinien zwischen Elementen), `compact` (reduzierter Zeilenabstand). Default: `default`. `displayType` ist ein Darstellungstyp, kein semantischer Variant — Details: [theming.md](../concepts/theming.md). |
| `displayValue` | „Value-Anzeige" | SelectBox (Enum) | optional | Wie der `value` einer Zeile **dargestellt** wird: `none` („nicht anzeigen" — `value` bleibt rein Daten, wird nur im Event geliefert), `secondary` („sekundär darstellen" — trailing Text), `badge` („als Badge" — `value` als Badge-Pille, z. B. „Anzahl"/„Preis"). Default: `none`. Betrifft nur die **Anzeige**; `value` wird unabhängig davon stets im Event mitgeliefert. **Node-weit** (gilt für alle Zeilen gleich). |
| `badgeVariant` | „Badge Variant" | Variant-SelectBox | optional | **Nur sichtbar, wenn `displayValue = badge`.** Semantische Farbrolle der Badge — `SEVERITY_VARIANTS` (`primary`/`success`/`warning`/`danger`/`neutral`/`info`), identisch zu [ui-badge](../feedback/ui-badge.md). Default: `neutral`. Node-weit (eine Farbe für alle Badges; pro-Zeile-Farbe wäre Folgearbeit). |

### Gruppe „Auswahl"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `selectable` | „Auswählbar" | Checkbox (Boolean) | optional | Schaltet **Single-Select** ein: ein Klick auf eine Zeile **selektiert** sie (markiert sie visuell als ausgewählt). Default: `false`. Bei `false` ist die Liste rein anzeigend/klickbar, ohne Auswahl-Zustand. |
| `selectedId` | „Ausgewählt (id)" | typedInput (Binding, **zweiseitig**) | optional | **Nur relevant bei `selectable`.** Zweiseitiges Binding auf die `id` der ausgewählten Zeile (analog `activeTab` bei ui-tabs): liest die Auswahl aus dem gebundenen Store/State **und** schreibt sie beim Auswahlwechsel zurück. Bindbar: `state`/`store`/`query`/`routeParam`/`literal` + NR-Standard. Default: keine Auswahl. Ungültige id → keine Zeile markiert. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `itemClick` (immer verfügbar), `itemSelect` (**nur sinnvoll bei `selectable`**). Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = **Konfigurationsreihenfolge**). Siehe Abschnitt „Output". |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Reihenfolge innerhalb des Slots bei `horizontal`/`vertical`-Layout. |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (1-basiert) | optional | Gitter-Position bei `grid`-Layout (1-basiert). |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld | optional | Gitter-Spannweite bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Position bei `absolute`-Layout. |

Welche Platzierungsfelder sichtbar sind, hängt vom Layout-Preset des Parent-Slots ab — `installLayoutChildPropRows()` blendet sie dynamisch ein. Details: [layout.md](../concepts/layout.md).

### Gruppe „Basis-Felder" (P139 / ADR 0015)

Von `ui-app` injizierte, knotenübergreifende Felder (Anwendbarkeit per
`resolveBaseFieldApplicability`). In der „Allgemein"-Gruppe, `size` unter
„Erweitert":

| Feld | Anwendbar | Beschreibung |
|---|---|---|
| `visible` | ja | Boolean-Zustand-typedInput; blendet die ganze Liste ein/aus. |
| `disabled` | ja | Sperrt die Zeilen-Interaktion (`itemClick`/`itemSelect`); ohne aktive Events wirkungslos. |
| `color` | ja | Allgemeine Farbe (non-variant; ui-list hat keinen semantischen `variant`). |
| `size` | **N/A** | Die Zeilendichte steuert `displayType` (`default`/`divided`/`compact`), **nicht** ein size-Token — Feld mit Hinweis deaktiviert. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-list"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Listenrendering mit Binding), **das Item-Schema** (String-Kurzform **oder**
`{id?,label,value?,icon?}` — `label` Pflicht, kein implizites Mapping), `value`
über `displayValue` (none/secondary/badge), Single-Select (`selectable`/
`selectedId`) sowie ein Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-list.md`.

## Item-Schema — das Datenmodell

`items` löst (über sein Binding) zu einem **Array** auf. Jedes Element ist
entweder ein **String** (Kurzform) oder ein **Item-Objekt**:

- **Kurzform `String`:** `["Ada", "Alan"]` wird intern auf `[{label:"Ada"},
  {label:"Alan"}]` gemappt — der String *ist* das `label`. Der einfachste Fall
  bleibt einfach.
- **Objektform:** das folgende Schema (der Vertrag zwischen Daten und Zeile).

| Feld | Typ | Pflicht | Default | Rolle |
|---|---|---|---|---|
| `label` | String | **ja** | — | **Anzeige** — Primärtext der Zeile. (Die String-Kurzform setzt genau dieses Feld.) |
| `id` | String | optional | Array-Index | **Identität** — wird als `rowId` in `itemClick`/`itemSelect` getragen **und** als Render-Key genutzt. Ohne `id` = Array-Index (instabil bei Umsortieren). |
| `value` | String / Number | optional | — | **Anwendungswert** der Zeile (z. B. Anzahl, Preis, Code). Wird — wenn vorhanden — **stets im Event mitgeliefert** (`row.value`). Die **Anzeige** steuert das Node-Feld `displayValue` (`none`/`secondary`/`badge`), nicht das Item. |
| `icon` | String (Icon-Name) | optional | — | **Anzeige** — führendes Icon. Erwartet einen Icon-Namen des App-Icon-Sets (s. [ui-icon](ui-icon.md)). Fehlt er → kein Icon. |

**Die drei Achsen, sauber getrennt:** `label`/`icon` = was man **sieht**, `id` =
**Identität** (Event/Key), `value` = **Anwendungswert** (Event-Nutzlast, optional
sichtbar via `displayValue`). Klick/Select liefert immer `{rowId, row}` — die
eindeutige Identität **und** das ganze Element inkl. `value`.

**Regeln für das Datenmodell:**

- Die Quelle von `items` **muss ein Array** sein (Strings und/oder Objekte).
  Skalar / Objekt / `null` als Wurzel → **leere Liste** (kein Crash).
- Ein **String**-Element ist die Kurzform für `{label: <string>}`.
- Ein **Objekt**-Element muss mindestens `label` tragen. Fehlt `label` → diese
  Zeile zeigt den Nicht-darstellbar-Hinweis (`"?"`, P104); die übrigen rendern
  normal.
- **Zusätzliche Felder werden ignoriert** — ein Datensatz darf mehr Felder haben
  (z. B. eine ganze DB-Zeile); ui-list liest **nur** `id`/`label`/`value`/`icon`.
- **Kein implizites Mapping.** Kommen die Daten in anderer Form (z. B.
  `{ customerId, name, city }`), müssen sie **vor** dem Store/`items` auf
  `{ id, label, value, icon }` abgebildet werden (in einem `function`-Knoten oder
  per `jsonata`-Binding). ui-list rät keine Feldnamen.

```json
[
  "Schnellauswahl ohne Objekt",
  { "id": "c-1", "label": "Offene Rechnungen", "value": 3,  "icon": "file" },
  { "id": "c-2", "label": "Bezahlt",           "value": 12, "icon": "check" }
]
```

(Mit `displayValue: "badge"` erscheinen `3` und `12` als Badge-Pillen in der
`badgeVariant`-Farbe; `"Schnellauswahl…"` ist die String-Kurzform.)

## Input

`ui-list` nimmt Eingangs-Messages entgegen, um seine Listenelemente zur Laufzeit
zu aktualisieren.

- **`msg.payload` (primäres Feld):** Enthält `msg.payload` einen nicht-`null`-Wert,
  wird `items` auf diesen Wert gesetzt und ein frischer SSE-Snapshot an alle
  verbundenen Clients der Parent-App gesendet. Primäres Feld: `items` (Array der
  Listenelemente). Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`:** Überschreibt beliebige Felder der Knotendefinition (z. B.
  `items`, `displayType`). Binding-Felder (`items`) müssen als Binding-Objekt
  übergeben werden.
- **Component-State-Messages** (`msg.ui.component.op`): `show`, `hide`.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird, wenn der Nutzer mit einem
Listenelement interagiert:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `itemClick` | Nutzer klickt auf ein Listenelement (unabhängig von `selectable`) | `event: "itemClick"`, `params: { rowId, row }`, `clientId`, `sourceId`, `appId` | Navigation, Detailansicht oder Aktion für das geklickte Element auslösen |
| `itemSelect` | **Auswahl wechselt** (nur bei `selectable`) | `event: "itemSelect"`, `params: { rowId, row }`, `clientId`, `sourceId`, `appId` | Auswahl-Zustand weiterverarbeiten (der `selectedId`-Roundtrip persistiert ihn bereits im gebundenen Store) |

`rowId` ist die `id` des Listenelements (sofern gesetzt), andernfalls der
Array-Index als String. `row` ist das **vollständige Elementobjekt** aus `items` —
**inkl. `value`** (`row.value`), unabhängig davon, ob `displayValue` es anzeigt.
So liefert ein Event immer **Identität (`rowId`) und Anwendungswert (`row.value`)**
zugleich. `clientId`/`sourceId`/`appId` folgen dem Standardformat (wie ui-tabs).
Allgemeines Event-Format: [events.md](../concepts/events.md).

> **`itemSelect` vs. `itemClick`:** `itemClick` feuert bei **jedem** Klick (auch
> ohne Auswahl-Modus). `itemSelect` feuert nur, wenn `selectable` an ist **und sich
> die Auswahl ändert** — und ist mit dem `selectedId`-Binding gekoppelt. Ohne
> `selectable` ist `itemSelect` wirkungslos.

**Antizipierte Wiring-Szenarien:**
- `itemClick` → `ui-action` (Navigation zur Detailseite des Elements).
- `itemSelect` → `ui-store` (`set` der aktuellen Auswahl).

## Theming

`ui-list` trägt sein Theming über `displayType` (`default`, `divided`, `compact`).
Da es sich um einen **Darstellungstyp** (keine semantische Ebene-2-Variante)
handelt, ist `displayType` nicht Teil des Variant-Vokabulars — es gibt keine
Variant-SelectBox für `ui-list`. Das App-weite Theme (Design-Tokens, an `ui-app`
konfiguriert) beeinflusst Abstände, Trennlinien-Farben und Typografie der Liste.
Details: [theming.md](../concepts/theming.md).

## Besonderheiten

- **Festes Item-Schema** (Details: [Item-Schema](#item-schema--das-datenmodell)).
  Komplexe Zeileninhalte (verschachtelte Komponenten pro Element) sind **nicht**
  Teil des ui-list-Contracts — dafür ist `ui-table` (Spalten) bzw. `ui-repeat`
  (beliebiger Subtree pro Element) vorgesehen.
- **`id` als Anker.** Stabile `id` = stabiler `rowId` im Event **und** stabiler
  Render-Key (überlebt Umsortieren); ohne `id` = Array-Index.

## Referenzen

- [stores.md](../concepts/stores.md) — Binding-Arten für `items`
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker, Event-Checkboxen
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [inputs.md](../concepts/inputs.md) — `msg.payload`-Verhalten und `msg.ui.patch`
- [layout.md](../concepts/layout.md) — Platzierungsfelder und Layout-Presets
- [theming.md](../concepts/theming.md) — `displayType` vs. Variant

## Offene Punkte

- **Mehrfachselektion** (Multi-Select) ist noch nicht modelliert — `selectable`
  deckt nur **Single-Select** ab. Multi-Select bräuchte ein Set-Binding statt
  `selectedId` (eigene Stufe).
- **Leerzustand** (`items = []`): heute eine leere Liste; ein eigener Empty-State
  (Platzhalter/CTA) ist offen — Zusammenspiel mit `ui-empty-state` ([[P152]]).
- **`value`-Formatierung** (Number → Tausender/Währung/Datum) bei `secondary`/
  `badge` ist nicht spezifiziert (heute roher String-Cast).
- **Pro-Zeile-Badge-Farbe:** `badgeVariant` ist node-weit; eine Variant pro Zeile
  (aus einem Item-Feld) wäre Folgearbeit.
- Virtuelle Liste / Lazy-Rendering für sehr lange Item-Arrays ist noch nicht spezifiziert.
- Icon-Rendering: `icon` erwartet einen Icon-Namen des App-Icon-Sets (s.
  [ui-icon](ui-icon.md)); die endgültige Festlegung der Icon-Bibliothek/-Notation
  ist an ui-icon gekoppelt und dort offen.

> **Hinweis zum Implementierungsstand (2026-06-13):** Der Knoten hängt hinter
> diesem Vertrag — der Editor nutzt heute ein nacktes `itemsPath`-Textfeld statt
> des `items`-typedInput, die Basis-Felder fehlen, Events-Checkboxen und Item-
> Schema-Validierung sind nicht verdrahtet. Angleichung: Epic `nodes/ui-list`
> (P171/P172).
