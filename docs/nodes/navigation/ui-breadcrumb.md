# `ui-breadcrumb`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-breadcrumb` rendert einen **hierarchischen Navigationspfad**, der dem Nutzer
zeigt, wo er sich in der App-Struktur befindet. **Alle Elemente** sind klickbar
und emittieren beim Klick ein `click`-Event auf dem Output-Port. Das aktuelle
Element (Seite) kann mit `active: true` markiert werden und wird anders gerendert,
bleibt aber ebenfalls klickbar. Die Items werden über eine von vier Methoden
definiert (P95).

## Einordnung

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`. Typischerweise in einem Header- oder Top-Slot einer Route oder des App-Layouts.
- **Kinder:** nur im Modus „Child Nodes (Slots)" (Mode = `breadcrumb`): beliebige View-Knoten als Items im Slot `default`; optionale Trennzeichen (z. B. `ui-icon`) im Slot `separator`.
- **Rolle zur Laufzeit:** darstellendes + interaktives Element; jeder Item-Klick löst ein `click`-Event auf dem Output-Port aus.

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
| `layout` | „Mode" | SelectBox | optional | `""` (Standard, Items/Binding-Modus) oder `"breadcrumb"` (Child-Nodes-Slots-Modus). |
| `items` | „Items" | typedInput (Binding) | konditional | Sichtbar wenn Mode = Standard. Die anzuzeigenden Pfad-Elemente als Array oder Binding (siehe unten). |
| `separator` | „Separator" | Textfeld | optional | Trennzeichen zwischen den Items (nur Modus Standard). Default: Shoelace-nativer `/`. |

#### Items-Formate (Modus Standard)

Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`).

Im Literal-Modus (Items-JSON) werden folgende Formate akzeptiert:

**String-Array:** `["Home", "Customers", "Details"]` — der String ist gleichzeitig Label und `action`-Wert.

**Objekt-Array:**

```json
[
  { "label": "Home",      "action": "/" },
  { "label": "Customers", "action": "/customers" },
  { "label": "Details",   "active": true }
]
```

##### Objekt-Item-Felder

| Feld | Typ | Beschreibung |
|---|---|---|
| `label` | String | Anzeigetext des Items (Pflicht). |
| `action` | String | Klick-Parameter, der per `params.action` im Event übermittelt wird. Fehlt er, wird `label` verwendet. |
| `active` | Boolean | Markiert das aktuelle-Seite-Item (`aria-current="page"`, unterschiedliches Rendering); Item bleibt klickbar. |

### Modus „Child Nodes (Slots)" (layout = `breadcrumb`)

Wenn `layout = "breadcrumb"` gesetzt ist, werden die Kind-Knoten im Slot `default`
als Breadcrumb-Items gerendert (jeder Kind-Knoten wird in ein `<sl-breadcrumb-item>` eingebettet).
Der Klick-Parameter ist die Node-ID des jeweiligen Kind-Knotens.
Ein optionaler Trennzeichen-Knoten kann in den Slot `separator` gemountet werden
(z. B. `ui-icon` mit einem Pfeil — Shoelace-nativer `slot="separator"`).

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-breadcrumb"`-Hilfetext soll knapp sein: Zweck
(Navigationspfad), Hinweis auf Item-Formate (String/Objekt/Slots), dass alle
Items klickbar sind, und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-breadcrumb.md`.

## Input

- **`msg.payload`** — ersetzt die Items-Liste vollständig; erwartet wird ein Array von `{ "label": string, "action"?: string, "active"?: boolean }` oder String-Array. Binding-gebundene Items werden bei der nächsten Binding-Auflösung wieder überschrieben.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `items`, `separator`). Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit der gesamten Breadcrumb-Zeile.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-breadcrumb` hat einen Output-Port. Der Knoten emittiert bei jedem Item-Klick
(auch bei `active`-Items):

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `click` | Nutzer klickt ein Item | `event: "click"`, `params.action` (Item-Action-Wert oder Label), `clientId`, `sourceId`, `appId` | Navigation oder andere Reaktion im Flow auslösen |

Im Child-Nodes-Modus (c) ist `params.action` die Node-ID des angeklickten Kind-Knotens.

**Antizipierte Wiring-Szenarien:**
- `click`-Output → `ui-action` (`navigate`, `to: msg.ui.params.action`) → navigiert zur übergeordneten Route.
- `onEnter` einer `ui-route` → `function`, das aus `params` ein dynamisches `items`-Array aufbaut → `ui-store` → `ui-breadcrumb` liest via Binding aus dem Store.

## Theming

`ui-breadcrumb` rendert eine horizontale Abfolge von Labels und Trennzeichen; das
Theme (Design-Tokens) wird von der Parent-App geerbt. Es gibt keinen eigenen
`variant`- oder `displayType`-Wert. Details: [theming.md](../concepts/theming.md).

## Tests

Testplan: `tests/e2e/nodes/view/ui-breadcrumb.tests.md`

## Referenzen

- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [stores.md](../concepts/stores.md) — Binding-Arten (`state`, `store`, `query`, `routeParam`)
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker
- [`ui-route`](../structure/ui-route.md) — Route-Lebenszyklus (`onEnter`/`onLeave`)

## Offene Punkte

- Automatische Ableitung der Breadcrumb-Items aus der Route-Hierarchie (ohne manuelles Binding) ist noch nicht modelliert.
