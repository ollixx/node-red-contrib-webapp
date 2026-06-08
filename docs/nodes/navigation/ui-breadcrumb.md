# `ui-breadcrumb`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-breadcrumb` rendert einen **hierarchischen Navigationspfad**, der dem Nutzer
zeigt, wo er sich in der App-Struktur befindet, und optionale Rücknavigation zu
übergeordneten Ebenen ermöglicht. Die Pfad-Elemente (Items) werden entweder
statisch konfiguriert oder dynamisch über ein Binding aus dem App-State bezogen.
Das letzte Element repräsentiert die aktuelle Seite und ist nicht navigierbar.

## Einordnung

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`. Typischerweise in einem Header- oder Top-Slot einer Route oder des App-Layouts.
- **Kinder:** keine — `ui-breadcrumb` hat keine eigenen Slots und nimmt keine View-Kinder.
- **Rolle zur Laufzeit:** rein darstellendes Element; interaktive Items lösen beim Klick eine Navigation aus (Output-Event oder direkte Route-Auflösung). Das letzte Item ist grundsätzlich nicht klickbar.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Breadcrumb N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. |

### Gruppe „Items"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `items` | „Items State Path" | typedInput (Binding) | **ja** | Die anzuzeigenden Pfad-Elemente. Kann entweder ein **statisches Array** oder ein **Binding** sein. Jedes Element hat die Form `{ "label": "<anzeigename>", "path": "<route-pfad>" }`. Das Feld `path` ist optional; fehlt es (typischerweise beim letzten Element), ist das Item nicht navigierbar. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). |
| `separator` | „Separator" | Textfeld | optional | Trennzeichen zwischen den Items. Default: `/`. |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-breadcrumb"`-Hilfetext soll knapp sein: Zweck
(Navigationspfad), Hinweis auf das Items-Array-Format (`label`/`path`),
dass das letzte Item nicht navigierbar ist, und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-breadcrumb.md`.

## Input

- **`msg.payload`** — ersetzt die Items-Liste vollständig; erwartet wird ein Array von `{ "label": string, "path"?: string }`. Binding-gebundene Items werden bei der nächsten Binding-Auflösung wieder überschrieben.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `items`, `separator`). Binding-Felder müssen als Binding-Objekt übergeben werden. Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit der gesamten Breadcrumb-Zeile. Format und Semantik: [inputs.md](../concepts/inputs.md).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-breadcrumb` hat einen Output-Port für Navigations-Events. Der Knoten emittiert,
wenn der Nutzer auf ein navigierbares Item (mit `path`) klickt:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `navigate` | Nutzer klickt ein Item mit `path` | `event: "navigate"`, `params.path`, `clientId`, `sourceId`, `appId` | Route-Wechsel auslösen — typischerweise direkt an eine `ui-action` mit `navigate`-Op verdrahten |

Das letzte Item in der Liste ist grundsätzlich nicht klickbar und erzeugt kein
`navigate`-Event. Hat ein Item kein `path`-Feld, ist es ebenfalls nicht klickbar.

**Antizipierte Wiring-Szenarien:**
- `navigate`-Output → `ui-action` (`navigate`, `to: msg.ui.params.path`) → navigiert zur übergeordneten Route. Alternativ kann der Output-Port weggelassen werden, wenn Items direkte `href`-Links zum Browser-nativen Routing nutzen sollen.
- `onEnter` einer `ui-route` → `function`, das aus `params` ein dynamisches `items`-Array aufbaut → `ui-store` → `ui-breadcrumb` liest via Binding aus dem Store.

## Theming

`ui-breadcrumb` rendert eine horizontale Abfolge von Labels und Trennzeichen; das
Theme (Design-Tokens) wird von der Parent-App geerbt. Es gibt keinen eigenen
`variant`- oder `displayType`-Wert. Details: [theming.md](../concepts/theming.md).

## Referenzen

- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [stores.md](../concepts/stores.md) — Binding-Arten (`state`, `store`, `query`, `routeParam`)
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker
- [`ui-route`](../structure/ui-route.md) — Route-Lebenszyklus (`onEnter`/`onLeave`)

## Offene Punkte

- Automatische Ableitung der Breadcrumb-Items aus der Route-Hierarchie (ohne manuelles Binding) ist noch nicht modelliert.
- `href`-Felder für externe Links (non-Route-Navigation) sind im Schema angelegt, aber die Interaktion mit dem Router (interner vs. externer Link) ist noch nicht spezifiziert.
