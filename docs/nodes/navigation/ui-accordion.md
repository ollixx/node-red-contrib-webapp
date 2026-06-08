# `ui-accordion`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-accordion` rendert eine **Liste aufklappbarer Abschnitte** (Sections). Jeder
Abschnitt hat einen Header (Bezeichnung) und einen Inhalts-Slot, in den View-Knoten
gemountet werden. Geöffnete Abschnitte zeigen ihren Inhalt; geschlossene blenden
ihn aus. Die Komponente eignet sich für FAQ-artige Strukturen, gegliederte
Einstellungsseiten und jeden anderen Fall, in dem mehrere Inhaltsbereiche
platzsparend untereinander angeordnet werden sollen, ohne zwischen Ansichten zu
navigieren.

## Einordnung

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`.
- **Kinder:** View-Knoten mounten per `mount: section:<sectionId>` in den Slot des jeweiligen Abschnitts. Slots werden aus der `sections`-Liste abgeleitet: ein Abschnitt mit `id: "details"` erzeugt den Slot `section:details`.
- **Rolle zur Laufzeit:** Der Renderer stellt pro Section einen Header und — bei geöffnetem Zustand — den zugehörigen Slot dar. Im Einzel-Modus (`multiple: false`) schließt das Öffnen eines Abschnitts alle anderen.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Accordion N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. |

### Gruppe „Sections"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `sections` | „Items (JSON array)" | Textfeld (JSON) | **ja** | Geordnete Liste der Abschnitte. Jedes Element hat die Form `{ "id": "<bezeichner>", "label": "<anzeigename>" }`. Mindestens eine Section erforderlich. Die `id` muss innerhalb des Knotens eindeutig sein; sie bestimmt den Slot-Namen (`section:<id>`). |
| `multiple` | „Allow Multiple Open" | Checkbox | optional | `true` — mehrere Sections können gleichzeitig offen sein. `false` (Default) — das Öffnen einer Section schließt alle anderen. |
| `defaultOpen` | — | Textfeld / JSON | optional | `id` (String) oder Array von `id`s der Sections, die beim ersten Rendern geöffnet sind. Ist `multiple: false` und mehrere Werte angegeben, wird nur der erste berücksichtigt. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `sectionOpen`, `sectionClose`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-accordion"`-Hilfetext soll knapp sein: Zweck (aufklappbare
Abschnitte), Hinweis auf `sections`-JSON (`id`/`label`), `multiple`-Flag und
Child-Mounting (`section:<id>`) sowie ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-accordion.md`.

## Input

- **`msg.payload`** — öffnet oder schließt eine Section programmatisch; erwartet wird `{ "id": "<sectionId>", "open": true|false }`. Alternativ kann direkt eine Section-`id` übergeben werden, was die Section öffnet. Ungültige Werte werden ignoriert.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `sections`, `multiple`, `defaultOpen`). Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit des gesamten Accordion-Blocks. Format und Semantik: [inputs.md](../concepts/inputs.md).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird, wenn der Nutzer eine Section
öffnet oder schließt:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `sectionOpen` | Nutzer öffnet eine Section | `event: "sectionOpen"`, `params.sectionId`, `clientId`, `sourceId`, `appId` | Lazy-Daten für die geöffnete Section laden |
| `sectionClose` | Nutzer schließt eine Section | `event: "sectionClose"`, `params.sectionId`, `clientId`, `sourceId`, `appId` | Section-spezifischen Zustand aufräumen |

Solange kein Event aktiviert ist, emittiert der Knoten nichts.

**Antizipierte Wiring-Szenarien:**
- `sectionOpen` → `function`-Knoten, der aus `msg.ui.params.sectionId` erkennt, welche Daten geladen werden sollen → `ui-store`/`ui-query` mit den Daten beliefern (Lazy-Loading).
- Kein Wiring nötig, wenn alle Section-Inhalte statisch konfiguriert sind.

## Theming

`ui-accordion` rendert Header-Zeilen und Aufklapp-Bereiche; das Theme
(Design-Tokens) wird von der Parent-App geerbt. Es gibt keinen eigenen `variant`-
oder `displayType`-Wert — das visuelle Erscheinungsbild wird ausschließlich über
Design-Tokens gesteuert. Details: [theming.md](../concepts/theming.md).

## Referenzen

- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [editor.md](../concepts/editor.md) — Mount-Picker, Event-Checkboxen

## Offene Punkte

- Animationsdauer und -art (Ease, Slide, Fade) sind noch nicht über Tokens spezifiziert.
- Ob `defaultOpen` zur Laufzeit reaktiv nachgeführt wird (bei Binding-Änderung) oder nur beim ersten Rendern gilt, ist noch offen.
- Ein optionaler Icon-Slot pro Section-Header ist noch nicht modelliert.
