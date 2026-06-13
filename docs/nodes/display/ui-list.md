# `ui-list`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-list` rendert eine **strukturierte Liste** an einem Mount-Ziel. Die
Listenelemente werden über das `items`-Binding bereitgestellt — entweder als
statisches Array oder dynamisch aus State, Query oder Node-RED-Kontext. Jedes
Element folgt einem **festen Item-Schema** (`id`/`label`/`value`/`icon`) — dieses
Schema ist der **Vertrag zwischen deinen Daten und der gerenderten Zeile** und in
[„Item-Schema — das Datenmodell"](#item-schema--das-datenmodell) exakt beschrieben.
Der visuelle Darstellungsmodus (`displayType`) steuert, ob die Liste standard,
geteilt oder kompakt erscheint. Nutzerinteraktionen (Klick, Auswahl) werden als
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
- **Rolle zur Laufzeit:** der Renderer löst `items` auf, iteriert über das Array
  und erzeugt pro Element eine Listenzelle mit Label, optionalem Icon und
  optionalem Wert.

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
| `items` | „Items" | typedInput (Wert-Binding) | **ja** | Array der Listenelemente. Bindbar über alle Wert-Binding-Arten: `literal` (statisches Array, direkt im Editor als JSON gepflegt), `state`, `query`, `routeParam`, `store` (Store-Picker), `msg`/`flow`/`global`/`jsonata`/`env`. Die **Form jedes Elements** ist in [„Item-Schema"](#item-schema--das-datenmodell) festgelegt. Binding-Arten: [stores.md](../concepts/stores.md). **Migration:** ein bestehendes `itemsPath` (nacktes Textfeld) wird als `state`-Binding auf `items` übernommen; das separate `itemsPath`-Feld entfällt. |
| `displayType` | „Display Type" | SelectBox | optional | Darstellungsmodus der Liste: `default` (Standard-Liste ohne Trennlinie), `divided` (mit horizontalen Trennlinien zwischen Elementen), `compact` (reduzierter Zeilenabstand). Default: `default`. `displayType` ist ein Darstellungstyp, kein semantischer Variant — Details: [theming.md](../concepts/theming.md). |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `itemClick`, `itemSelect`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Reihenfolge innerhalb des Slots bei `horizontal`/`vertical`-Layout. |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (1-basiert) | optional | Gitter-Position bei `grid`-Layout (1-basiert). |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld | optional | Gitter-Spannweite bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Position bei `absolute`-Layout. |

Welche Platzierungsfelder sichtbar sind, hängt vom Layout-Preset des Parent-Slots ab — `installLayoutChildPropRows()` blendet sie dynamisch ein. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-list"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Listenrendering mit Binding), **das Item-Schema** (`{id?,label,value?,icon?}`
— `label` Pflicht, kein implizites Mapping), Hinweis auf `displayType` und Events
sowie ein Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-list.md`.

## Item-Schema — das Datenmodell

`items` löst (über sein Binding) zu einem **Array von Item-Objekten** auf. Genau
dieses Objektschema ist der Vertrag zwischen den Daten und der gerenderten Zeile.

| Feld | Typ | Pflicht | Default | Gerenderte Wirkung |
|---|---|---|---|---|
| `label` | String | **ja** | — | Primärtext der Zeile (sichtbare Hauptzeile). |
| `value` | String | optional | — | Sekundär-/Trailing-Text (je `displayType` rechts/darunter). Fehlt er → nur das Label. |
| `icon` | String (Icon-Name) | optional | — | Führendes Icon. Erwartet einen Icon-Namen des App-Icon-Sets (s. [ui-icon](ui-icon.md)). Fehlt er → kein Icon. |
| `id` | String | optional | Array-Index | Stabiler Zeilen-Anker: wird als `rowId` in `itemClick`/`itemSelect` getragen **und** als Render-Key genutzt. Ohne `id` = Array-Index (instabil bei Umsortieren). |

**Regeln für das Datenmodell:**

- Die Quelle von `items` **muss ein Array** sein. Skalar / Objekt / `null` →
  **leere Liste** (kein Crash).
- Jedes Element muss mindestens `label` tragen. Fehlt `label` an einem Element →
  diese Zeile zeigt den Nicht-darstellbar-Hinweis (`"?"`, P104); die übrigen Zeilen
  rendern normal.
- **Zusätzliche Felder werden ignoriert** — ein Datensatz darf mehr Felder haben
  (z. B. eine ganze DB-Zeile); ui-list liest **nur** `id`/`label`/`value`/`icon`.
- **Kein implizites Mapping.** Kommen die Daten in anderer Form (z. B.
  `{ customerId, name, city }`), müssen sie **vor** dem Store/`items` auf
  `{ id, label, value, icon }` abgebildet werden (in einem `function`-Knoten oder
  per `jsonata`-Binding). ui-list rät keine Feldnamen.

```json
[
  { "id": "c-1", "label": "Ada Lovelace", "value": "London",     "icon": "user" },
  { "id": "c-2", "label": "Alan Turing",  "value": "Manchester"                  }
]
```

## Basis-Felder (P139 / ADR 0015)

Die „Allgemein"/„Erweitert"-Basis-Felder gelten wie folgt (Anwendbarkeit per
`resolveBaseFieldApplicability`):

- **`visible`** — anwendbar (Boolean-Zustand; blendet die ganze Liste ein/aus).
- **`disabled`** — anwendbar: sperrt die Zeilen-Interaktion (`itemClick`/
  `itemSelect`); ohne aktive Events wirkungslos.
- **`color`** — anwendbar (allgemeine Farbe; ui-list hat keinen semantischen
  `variant`).
- **`size`** — **N/A**: die Zeilendichte steuert `displayType`
  (`default`/`divided`/`compact`), **nicht** ein size-Token (mit Hinweis
  deaktiviert).

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
| `itemClick` | Nutzer klickt auf ein Listenelement | `event: "itemClick"`, `params: { rowId, row }` | Navigation, Detailansicht oder Aktion für das geklickte Element auslösen |
| `itemSelect` | Nutzer wählt ein Element aus (Auswahl-Modus) | `event: "itemSelect"`, `params: { rowId, row }` | Auswahl-Zustand in einem Store persistieren |

`rowId` ist die `id` des Listenelements (sofern gesetzt), andernfalls der
Array-Index als String. `row` ist das vollständige Elementobjekt aus `items`.
Allgemeines Event-Format: [events.md](../concepts/events.md).

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

- Mehrfachselektion (Checkbox-Modus pro Zeile) ist noch nicht modelliert.
- Virtuelle Liste / Lazy-Rendering für sehr lange Item-Arrays ist noch nicht spezifiziert.
- Icon-Rendering: `icon` erwartet einen Icon-Namen des App-Icon-Sets (s.
  [ui-icon](ui-icon.md)); die endgültige Festlegung der Icon-Bibliothek/-Notation
  ist an ui-icon gekoppelt und dort offen.

> **Hinweis zum Implementierungsstand (2026-06-13):** Der Knoten hängt hinter
> diesem Vertrag — der Editor nutzt heute ein nacktes `itemsPath`-Textfeld statt
> des `items`-typedInput, die Basis-Felder fehlen, Events-Checkboxen und Item-
> Schema-Validierung sind nicht verdrahtet. Angleichung: Epic `nodes/ui-list`
> (P171/P172).
