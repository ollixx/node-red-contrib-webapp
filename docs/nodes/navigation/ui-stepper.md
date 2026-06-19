# `ui-stepper`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-stepper` rendert einen **mehrstufigen Prozessindikator** (Wizard-Leiste),
der den Nutzer durch eine geordnete Folge von Schritten führt. Jeder Schritt
hat einen Inhalts-Slot, in den View-Knoten gemountet werden. Der aktive Schritt
wird über ein Binding gesteuert; die Komponente zeigt den Fortschritt und — je
nach Konfiguration — ob der Nutzer frei zwischen Schritten springen darf oder
sie sequenziell durchlaufen muss. Typische Anwendungsfälle sind mehrseitige
Formulare, Checkout-Prozesse und geführte Konfigurationsdialoge.

## Einordnung

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`.
- **Kinder:** View-Knoten mounten per `mount: step:<stepId>` in den Slot des jeweiligen Schritts. Slots werden aus der `steps`-Liste abgeleitet: ein Schritt mit `id: "address"` erzeugt den Slot `step:address`. Es ist immer genau der Slot des aktiven Schritts sichtbar.
- **Rolle zur Laufzeit:** Der Renderer stellt die Schritt-Leiste dar und rendert nur den Slot des aktiven Schritts. Der Fortschritt ist reaktiv: ändert sich das `activeStep`-Binding, wechselt die Ansicht.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Stepper N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. |

### Gruppe „Schritte"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `steps` | „Steps (JSON array)" | Textfeld (JSON) | **ja** | Geordnete Liste der Schritte. Jedes Element hat die Form `{ "id": "<bezeichner>", "label": "<anzeigename>" }`. Mindestens zwei Schritte erforderlich. Die `id` muss innerhalb des Knotens eindeutig sein; sie bestimmt den Slot-Namen (`step:<id>`) und ist das Token, das `activeStep` trägt. |
| `activeStep` | „Active Step" | typedInput (Binding, zweiseitig) | **ja** | Zweiseitiges Binding auf den aktuell aktiven Schritt (P156, ADR 0012): liest den aktiven Schritt aus dem gebundenen Store/State, und das `stepChange`-Event schreibt den gewählten Schritt zurück (Roundtrip). Der Stepper zeigt diesen Schritt und seinen Slot; alle anderen Schritte sind inaktiv. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). Wird ein ungültiger Wert geliefert, fällt die Komponente auf den ersten Schritt zurück. |
| `linear` | — | Checkbox | optional | `true` (Default) — der Nutzer kann nur in den jeweils nächsten oder vorherigen Schritt wechseln; abgeschlossene Schritte können erneut besucht werden, übersprungene nicht. `false` — freie Navigation zwischen allen Schritten. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `orientation` | „Orientation" | SelectBox | optional | Ausrichtung der Schritt-Leiste: `horizontal` (nebeneinander, Standard), `vertical` (untereinander). Default: `horizontal`. Im Feld `orientation` gespeichert, im Editor als „Orientation" beschriftet. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `stepChange`, `complete`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-stepper"`-Hilfetext soll knapp sein: Zweck (Wizard/Prozessindikator),
Hinweis auf `steps`-JSON (`id`/`label`, min. 2), `activeStep`-Binding + Store-Roundtrip,
`linear`-Flag und Child-Mounting (`step:<id>`) sowie ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-stepper.md`.

## Input

- **`msg.payload`** — setzt den aktiven Schritt; der Wert muss einer der `id`-Werte aus der `steps`-Liste sein. Bei `linear: true` wird geprüft, ob der Schritt erreichbar ist (vorangegangene Schritte abgeschlossen); nicht erreichbare Schritte werden ignoriert.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `steps`, `linear`, `variant`). Binding-Felder müssen als Binding-Objekt übergeben werden. Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit des gesamten Stepper-Blocks. Format und Semantik: [inputs.md](../concepts/inputs.md).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird, wenn der Nutzer einen Schritt
wechselt oder den letzten Schritt abschließt:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `stepChange` | Nutzer wechselt zu einem anderen Schritt | `event: "stepChange"`, `params.stepId`, `params.previousStepId`, `clientId`, `sourceId`, `appId` | Neuen aktiven Schritt in den `activeStep`-Store schreiben; schritt-spezifische Daten laden oder Validierung des verlassenen Schritts anstoßen |
| `complete` | Nutzer schließt den letzten Schritt ab | `event: "complete"`, `clientId`, `sourceId`, `appId` | Formulardaten übermitteln, zu einer Bestätigungsseite navigieren, Prozess abschließen |

Solange kein Event aktiviert ist, emittiert der Knoten nichts.

**Antizipierte Wiring-Szenarien:**
- `stepChange` → `ui-store` (`set`, `path: "activeStep"`, `value: msg.ui.params.stepId`) → `activeStep`-Binding liest denselben Store → Stepper aktualisiert sich reaktiv.
- `stepChange` → `function`-Knoten, das `params.previousStepId` auswertet und die eingegebenen Daten des verlassenen Schritts in einen `ui-store` schreibt (Zwischenspeicherung).
- `complete` → `function`/HTTP-Request, das alle gesammelten Formulardaten übermittelt → `ui-action` navigiert zur Bestätigungsseite.
- Vor-/Zurück-Schaltflächen im Slot-Inhalt eines Schritts sind `ui-button`-Knoten, deren `click`-Events an eine `function`-Node verdrahtet werden, die den `activeStep`-Store setzt.

## Theming

`ui-stepper` rendert eine Schritt-Leiste mit Status-Indikatoren (aktiv, abgeschlossen, ausstehend)
und den Slot-Inhalt des aktiven Schritts; das Theme (Design-Tokens) wird von der Parent-App geerbt.
Der `variant`-Wert (`horizontal`, `vertical`) steuert die Ausrichtung der Leiste. Details:
[theming.md](../concepts/theming.md).

## Referenzen

- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [stores.md](../concepts/stores.md) — Binding-Arten und Store-Roundtrip
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker, Event-Checkboxen

## Offene Punkte

- Schritt-Status (abgeschlossen / fehlerhaft / ausstehend) ist noch nicht als bindbares Feld modelliert — derzeit wird der Status aus der Position des aktiven Schritts abgeleitet.
- Ob `linear: true` clientseitig oder serverseitig durchgesetzt wird (und welche Fehlermeldung bei Verletzung ausgegeben wird), ist noch nicht spezifiziert.
- Ein optionaler Icon- oder Badge-Slot pro Schritt-Header ist noch nicht modelliert.
