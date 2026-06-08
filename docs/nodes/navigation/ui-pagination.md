# `ui-pagination`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-pagination` rendert **Seitennavigations-Controls** (Vor/Zurück, Seitenzahlen)
für paginierte Datensätze. Der Knoten zeigt die aktuelle Seite und die Gesamtzahl
der Seiten aus bindablen Feldern an und emittiert einen Event, wenn der Nutzer zu
einer anderen Seite navigiert. Er arbeitet typischerweise mit `ui-query` und
`ui-store` zusammen: der Store hält die aktuelle Seite, `ui-query` lädt die
passenden Daten, und `ui-pagination` gibt das visuelle Steuerelement dafür ab.

## Einordnung

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`. Typischerweise unterhalb einer `ui-table` oder `ui-list` im selben Container oder in einem dedizierten Footer-Slot.
- **Kinder:** keine — `ui-pagination` hat keine eigenen Slots.
- **Rolle zur Laufzeit:** rein darstellendes Steuerelement; es schreibt keinen Zustand selbst zurück. Der `pageChange`-Event-Output muss im Flow mit einem Store-Update verdrahtet werden.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Pagination N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. |

### Gruppe „Paginierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `page` | „Current Page Path" | typedInput (Binding) | **ja** | Binding auf die aktuell angezeigte Seitennummer (1-basiert). Typischerweise an einen `ui-store`-Wert gebunden, der beim `pageChange`-Event aktualisiert wird. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). |
| `totalPages` | „Total Items Path" | typedInput (Binding) | **ja** | Binding auf die Gesamtzahl der Seiten. Wird typischerweise aus einem `ui-query`-Ergebnis bezogen (z. B. `Math.ceil(total / pageSize)`). Bindbare Arten wie `page`. |
| `pageSize` | „Page Size" | typedInput (Binding) | optional | Binding auf die Anzahl der Einträge pro Seite. Wenn gesetzt und `totalItems` ebenfalls gesetzt, kann `totalPages` aus beiden berechnet werden. Bindbare Arten wie `page`. |
| `totalItems` | — | typedInput (Binding) | optional | Binding auf die Gesamtanzahl der Einträge (nicht Seiten). Wird zusammen mit `pageSize` und `showInfo` genutzt, um die Info-Zeile „Einträge X–Y von Z" darzustellen. Bindbare Arten wie `page`. |
| `showInfo` | — | Checkbox | optional | `true` — zeigt eine Info-Zeile mit dem Bereich der aktuell sichtbaren Einträge (z. B. „Einträge 11–20 von 47"). Erfordert `totalItems` und `pageSize`. Default: `false`. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `variant` | „Variant" | Variant-SelectBox | optional | Visueller Stil der Seitennavigation: `numbered` (Seitenzahlen sichtbar, Standard), `simple` (nur Vor/Zurück-Pfeile). Default: `numbered`. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbares Ausgangs-Event: `pageChange`. Erzeugt bei Aktivierung einen Output-Port. Siehe Abschnitt „Output". |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-pagination"`-Hilfetext soll knapp sein: Zweck
(Seitennavigation), Pflicht-Bindings `page` und `totalPages`, Hinweis auf
`pageChange`-Event + Store-Roundtrip und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-pagination.md`.

## Input

- **`msg.payload`** — setzt die aktuelle Seite direkt (Ganzzahl ≥ 1). Der Wert wirkt wie ein `page`-Update; das `page`-Binding wird bei der nächsten Binding-Auflösung wieder führend.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `variant`, `showInfo`). Binding-Felder müssen als Binding-Objekt übergeben werden. Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit der Seitennavigation. Format und Semantik: [inputs.md](../concepts/inputs.md).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

Pro aktivem Event ein Output-Port:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `pageChange` | Nutzer wechselt die Seite | `event: "pageChange"`, `params.page`, `clientId`, `sourceId`, `appId` | Neue Seite in den `page`-Store schreiben → `ui-query` liest den Store → lädt die passenden Daten |

`params.page` trägt die neu gewählte Seitennummer (1-basiert). Erst wenn der Flow
den Store-Wert aktualisiert und der Store das `page`-Binding des `ui-pagination`
versorgt, ändert sich die visuelle Darstellung der aktuellen Seite.

**Antizipierte Wiring-Szenarien:**
- `pageChange` → `ui-store` (`set`, `path: "page"`, `value: msg.ui.params.page`) → `page`-Binding liest aus demselben Store → `ui-pagination` aktualisiert sich reaktiv.
- `ui-store`-Änderungs-Output → `ui-query` mit `page`-Parameter → `ui-table`/`ui-list` zeigt neue Daten.
- `pageChange` → `function`, das zusätzlich `pageSize` aus dem State liest, `offset` berechnet und einen HTTP-Request abschickt.

## Theming

`ui-pagination` rendert Schaltflächen und ggf. Seitenzahl-Links; das Theme
(Design-Tokens) wird von der Parent-App geerbt. Der `variant`-Wert (`numbered`,
`simple`) steuert die visuelle Ausprägung unabhängig vom Token-Set. Details:
[theming.md](../concepts/theming.md).

## Referenzen

- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [stores.md](../concepts/stores.md) — Binding-Arten und Store-Roundtrip
- [editor.md](../concepts/editor.md) — typedInput, Variant-SelectBox, Mount-Picker
- [`ui-query`](../state/ui-query.md) — Datenladen mit page/pageSize-Parametern

## Offene Punkte

- Ob `totalPages` alternativ aus `totalItems` / `pageSize` automatisch berechnet werden soll (statt explizites Binding), ist noch nicht abschließend entschieden.
- Tastaturnavigation (Arrow-Keys, Eingabe einer Seitenzahl) ist noch nicht spezifiziert.
- Maximale Anzahl der angezeigten Seitenzahlen (Ellipsis-Verhalten) ist noch nicht über Felder konfigurierbar.
