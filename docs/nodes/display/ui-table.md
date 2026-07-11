# `ui-table`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-table` rendert **tabellarische Daten** an einem Mount-Ziel. Die Zeilendaten
werden über das `rows`-Binding bereitgestellt; die Spaltenstruktur wird
deklarativ über `columns` konfiguriert. Spalten können einfache Datenfelder
oder typisierte Renderer (Text, Zahl, Datum, Checkbox, Aktions-Buttons) sein und
optional sortier- sowie filterbar gemacht werden. Nutzerinteraktionen
(Zeilenauswahl, Zeilen-Aktion, Checkbox-Änderung, Zell-Auswahl) werden als
Events auf konfigurierten Output-Ports emittiert. Ein optionaler Footer-Slot
erlaubt es, Paginierung, Aggregationen oder freien Inhalt unterhalb der Tabelle
einzuhängen.

## Einordnung

- **Parent:** ein Slot eines `ui-app`-, `ui-route`-, `ui-dialog`- oder
  `ui-container`-Knotens. Deklariert über `mount` oder `parent`.
- **Kinder:** View-Knoten können über `mount` in den Footer-Slot der Tabelle
  eingehängt werden, wenn `footer: true` gesetzt ist (Mount-Pfad
  `table:<id>/footer`).
- **Erreichbarkeit:** als Teil des gerenderten Snapshots der Parent-Route bzw.
  des Parent-Dialogs.
- **Rolle zur Laufzeit:** der Renderer löst `rows` auf, iteriert über das Array
  und erzeugt pro Zeile eine Tabellenreihe gemäß der Spalten-Konfiguration.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Table N`. |
| `mount` | „Parent Slot" | Mount-Picker (hierarchischer Baum) | **ja** | Mount-Ziel des Knotens. Auswahl aus dem Slot-Baum (`installReferenceSelectors({ mount: true })`). Gespeichert als Mount-Pfad `<type>:<id>/<slot>`. |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `columns` | „Columns" | Textfeld (kommagetrennte Liste oder strukturierte Definition) | **ja** | Spaltendefinition der Tabelle. Mindestens eine Spalte erforderlich. Kurzform: kommagetrennte Property-Keys (z. B. `name,email,status`) — Key ist gleichzeitig Header-Label. Vollform: strukturiertes Objekt pro Spalte mit `key`, `label` (optional), `type` (`text`\|`number`\|`date`\|`checkbox`\|`actions`), `sortable` (boolean), `filterable` (boolean), `width` (px). Rückwärtskompatibel: ein einfacher String-Key wird als `{ key, label: key, type: "text" }` interpretiert. |
| `rows` | „Rows" | typedInput (Binding, Default `json`) | optional | **Strukturelle Daten-Quelle** der Tabellenzeilen (ein Array von Zeilen-Objekten) — die Tabelle rendert ihre Zeilen selbst. Bindbar über alle Standard-Binding-Arten: `json` (statisches Array-Literal), `state`, `query`, `routeParam`, `store`, `reactive`, `msg`/`flow`/`global`/`jsonata`/`env`. Jedes Zeilenobjekt sollte die in `columns` deklarierten Keys enthalten; fehlende Keys werden als leerer String gerendert. Ein bestehendes Legacy-`rowsPath` wird automatisch als `state`-Binding übernommen (P158). Ist nichts gebunden, rendert die Tabelle leer. Binding-Arten: [stores.md](../concepts/stores.md). |
| `footer` | „Footer Slot" | Checkbox | optional | Aktiviert einen Footer-Slot unterhalb des `<tbody>`. Ist `footer: true`, können View-Knoten über `mount: table:<id>/footer` dort eingehängt werden — typisch für Pagination, Aggregationen oder freie Inhalte. Default: `false`. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `rowSelect`, `rowAction`, `checkboxChange`, `cellSelect`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Reihenfolge innerhalb des Slots bei `horizontal`/`vertical`-Layout. Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (1-basiert) | optional | Gitter-Position bei `grid`-Layout (1-basiert). |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld | optional | Gitter-Spannweite bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Position bei `absolute`-Layout. |

Welche Platzierungsfelder sichtbar sind, hängt vom Layout-Preset des Parent-Slots ab — `installLayoutChildPropRows()` blendet sie dynamisch ein. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-table"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Tabellenrendering mit Binding), kurzer Hinweis auf Spaltendefinition,
Footer-Slot und Events sowie ein Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-table.md`.

## Input

`ui-table` nimmt Eingangs-Messages entgegen, um seine Zeilendaten zur Laufzeit
zu aktualisieren.

- **`msg.payload` (primäres Feld):** Enthält `msg.payload` einen nicht-`null`-Wert,
  wird `rows` auf diesen Wert gesetzt und ein frischer SSE-Snapshot an alle
  verbundenen Clients der Parent-App gesendet. Primäres Feld: `rows` (Array der
  Tabellenzeilen). Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`:** Überschreibt beliebige Felder der Knotendefinition (z. B.
  `rows`, `columns`, `footer`). Binding-Felder (`rows`) müssen als Binding-Objekt
  übergeben werden.
- **Component-State-Messages** (`msg.ui.component.op`): `show`, `hide`.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird, wenn der Nutzer mit einer
Tabellenzeile oder -zelle interagiert:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `rowSelect` | Nutzer klickt auf eine Zeile | `event: "rowSelect"`, `params: { rowId, row }` | Navigation zur Detailseite oder Laden von Zeilen-Daten |
| `rowAction` | Nutzer klickt einen Aktions-Button in einer Zeile | `event: "rowAction"`, `params: { rowId, row, actionLabel }` | Zeilen-gebundene Aktion auslösen (Bearbeiten, Löschen, …) |
| `checkboxChange` | Nutzer ändert eine Checkbox-Spalte | `event: "checkboxChange"`, `params: { rowId, checked }` | Zeilenauswahl-Zustand im Flow verarbeiten |
| `cellSelect` | Nutzer klickt eine einzelne Zelle | `event: "cellSelect"`, `params: { rowId, row }` | Inline-Bearbeitung oder Zell-Detail einleiten |

`rowId` ist der Primärschlüssel der Zeile (sofern im Zeilenobjekt als `id`
vorhanden), andernfalls der Array-Index als String. `row` ist das vollständige
Zeilenobjekt aus `rows`. `actionLabel` ist das Label des geklickten
Aktions-Buttons aus der `actions`-Spalte. Allgemeines Event-Format:
[events.md](../concepts/events.md).

**Antizipierte Wiring-Szenarien:**
- `rowSelect` → `ui-action` (Navigation zur Detailseite mit `params.rowId`).
- `rowSelect` → `ui-store` (`set` der aktuellen Auswahl) → `ui-query` (Laden der
  Detaildaten).
- `checkboxChange` → `function`/`ui-store` (Mehrfachauswahl-Set pflegen).
- `rowAction` → `function` (API-Call zum Löschen/Bearbeiten), dann
  `ui-store`/`ui-query` aktualisieren.

## Theming

`ui-table` hat kein eigenes Varianten-Feld. Das App-weite Theme (Design-Tokens,
an `ui-app` konfiguriert) beeinflusst Tabellenfarben, Typografie, Rahmen und
Zeilenabstände über die `--wa-*`-Custom-Properties. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **Flexible Spaltendefinition.** `columns` akzeptiert sowohl eine einfache
  kommagetrennte Key-Liste als auch vollständige Spaltenobjekte mit `type`,
  `sortable`, `filterable` und `width`. Die vollständige Form ist rückwärtskompatibel
  zur Kurzform.
- **Footer-Slot als Layout-Slot.** Der Footer-Slot verhält sich wie jeder andere
  Layout-Slot — View-Knoten mounten darin mit ihrem eigenen Platzierungsfeld.
  Das Layout-Preset des Slots bestimmt die Child-Props der gemounteten Knoten.
- **`selectAction` (deprecated).** Das Feld `selectAction` (direkte Action-Referenz
  bei Zeilenklick) ist durch `events: [rowSelect]` abgelöst; bestehende Flows
  werden weiterhin unterstützt, neue Flows sollen Events verwenden.

## Referenzen

- [stores.md](../concepts/stores.md) — Binding-Arten für `rows`
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker, Event-Checkboxen
- [events.md](../concepts/events.md) — Event-Format, `params`-Struktur, Output-Ports
- [inputs.md](../concepts/inputs.md) — `msg.payload`-Verhalten und `msg.ui.patch`
- [layout.md](../concepts/layout.md) — Platzierungsfelder, Footer-Slot
- [theming.md](../concepts/theming.md) — Design-Tokens

## Offene Punkte

- Mehrfachselektion (Checkbox pro Zeile + Kopfzeilen-Checkbox „Alle") ist noch nicht vollständig modelliert.
- Serverseitige Sortierung und Filterung: ob Events für Spaltenklick/Filter-Input emittiert werden, ist noch nicht spezifiziert.
- Virtuelles Scrollen für sehr große Datensätze ist noch nicht Teil des Contracts.
