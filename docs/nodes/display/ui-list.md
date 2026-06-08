# `ui-list`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-list` rendert eine **strukturierte Liste** an einem Mount-Ziel. Die
Listenelemente werden über das `items`-Binding bereitgestellt — entweder als
statisches Array oder dynamisch aus State, Query oder Node-RED-Kontext. Jedes
Element kann eine ID, ein Label, einen Wert und ein Icon tragen. Der visuelle
Darstellungsmodus (`displayType`) steuert, ob die Liste standard, geteilt oder
kompakt erscheint. Nutzerinteraktionen (Klick, Auswahl) werden als Events auf
konfigurierten Output-Ports emittiert.

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
| `items` | „Items" | typedInput (Binding) | **ja** | Array der Listenelemente. Bindbar über alle Standard-Binding-Arten: `literal` (statisches Array), `state` (State-Pfad), `query` (Query-Pfad), `routeParam`, `store` (Store-Picker), `msg`/`flow`/`global`/`jsonata`/`env`. Jedes Element kann die Felder `id` (optional, String), `label` (Pflicht, String), `value` (optional, String) und `icon` (optional, Icon-Name) tragen. Binding-Arten: [stores.md](../concepts/stores.md). |
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
Zweck (Listenrendering mit Binding), Hinweis auf `displayType` und Events sowie ein
Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-list.md`.

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

- **Statisches Item-Schema.** Jedes Element im `items`-Array folgt dem Schema
  `{ id?, label, value?, icon? }`. `label` ist Pflicht; alle anderen Felder sind
  optional. Komplexe Zeileninhalte (verschachtelte Komponenten pro Element) sind
  nicht Teil des Contracts von `ui-list` — dafür ist `ui-table` mit strukturierten
  Spaltendefinitionen vorgesehen.
- **`id` als Anker.** Ist `id` gesetzt, verwendet der Knoten ihn als `rowId` im
  Event-Payload; ohne `id` wird der Array-Index verwendet. Eine stabile `id`
  erleichtert die Zuordnung im verdrahteten Flow.

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
- Icon-Rendering: welche Icon-Bibliothek und welches Format `icon` erwartet, ist noch nicht festgelegt.
