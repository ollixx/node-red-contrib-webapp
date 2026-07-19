# `ui-menu`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-menu` rendert ein **Navigationsmenü**, das die App-Routen für den Nutzer
zugänglich macht. Die Menü-Items werden statisch konfiguriert oder über ein
Binding aus dem App-State bezogen; das aktive Item (die aktuelle Route) kann
ebenfalls über ein Binding gesteuert werden. Das Feld `displayType`
(`sidebar`/`topbar`) benennt den **geplanten** räumlichen Darstellungsmodus;
er hat heute **keine beobachtbare Render-Wirkung** (s. u. „Darstellung").

## Einordnung

- **Parent:** eine `ui-app`, `ui-route`, `ui-dialog` oder ein `ui-container` — via `mount`. Typischerweise in einem `navbar`- oder `header`-Slot eines `app`-Layout-Parents.
- **Kinder:** keine — `ui-menu` hat keine eigenen Inhalts-Slots.
- **Rolle zur Laufzeit:** rein darstellendes Navigationselement; Klicks auf Items lösen eine Navigation aus (Output-Event). Das aktive Item wird aus dem `activeItem`-Binding gelesen und visuell hervorgehoben.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Menu N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Mount-Ziel im Parent-Knoten — Format `<type>:<id>/<slot>`. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `displayType` | „Display Type" | SelectBox | optional | Geplanter Darstellungstyp des Menüs (kein semantischer Variant, sondern ein Präsentationsmodus): `sidebar` (Default) oder `topbar`. **Noch nicht umgesetzt:** heute erzeugt **kein** Wert einen beobachtbaren Render-Unterschied — Renderer und Shoelace-Adapter verzweigen nicht auf `displayType`; beide Werte rendern ein nacktes `sl-menu`. Die räumlichen Modi (sidebar vertikal, topbar horizontal) sind **geplant**, aber noch nicht implementiert. Ein früher dokumentierter `dropdown`-Modus wurde entfernt (kein Trigger-Modell, im Editor nie wählbar). Ein deployter Legacy-Wert `dropdown` fällt verlustfrei auf den Default zurück (Schema `.catch("sidebar")`). |

### Gruppe „Items"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `items` | „Items" | typedInput (Binding) | **ja** | Die Menü-Einträge. Kann ein **statisches Array** oder ein **Binding** sein. Jedes Item hat die Form `{ "label": "<anzeigename>", "route"?: "<route-pfad>", "href"?: "<externer-link>", "path"?: "<pfad>", "icon"?: "<icon-name>", "children"?: [...] }`. Ein Item kann entweder `route` (interne Navigation), `href` (externer Link) oder `path` tragen — nicht mehrere. Kinder-Items (`children`) haben dieselbe Struktur ohne weiteren `children`-Level. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). |
| `activeRoute` | „Active Route" | typedInput (Binding) | optional | Binding auf den Pfad/die Route des aktuell aktiven Items (im Feld `activeRoute` gespeichert, typedInput-Carrier `activeRouteBinding`). Das Menü hebt das passende Item visuell hervor. Typischerweise an einen Store-Wert gebunden, der beim `onEnter` einer Route gesetzt wird. Bindbare Arten wie `items`. |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-menu"`-Hilfetext soll knapp sein: Zweck (Navigationsmenü),
Hinweis auf `displayType` (`sidebar`/`topbar`), Items-Format
(`label`/`route`/`icon`/`children`) und `activeItem`-Binding sowie ein Link auf
die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-menu.md`.

## Input

> **Ist-Zustand (P244):** `ui-menu` verwendet den Interaktions-Input-Handler
> (`interactionInputHandler` über `componentStateInputHandler`). Er konsumiert
> **weder `msg.payload` noch `msg.ui.patch`** — beide werden **unverändert
> durchgereicht** (Pass-Through). Ein Items-Ersatz oder Feld-Patch per Nachricht ist
> heute **nicht** verdrahtet (dieselbe knotenübergreifende Frage wie beim
> ui-icon-`msg.payload`-Follow-up, P235 — hier nur die Wahrheit dokumentiert, keine
> Richtungsentscheidung).

- **`msg.payload`** — **nicht** konsumiert; wird unverändert durchgereicht. Ein Items-Ersatz per Payload ist noch nicht implementiert.
- **`msg.ui.patch`** — **nicht** konsumiert; wird unverändert durchgereicht. Ein Feld-Patch per Nachricht ist noch nicht implementiert.
- **Interaktions-Verben** (`msg.ui.action.type`): `show`, `hide`, `select` — von einer verdrahteten `ui-action` dispatcht; lösen den zugehörigen Client-Push aus.
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` (sowie `enable`, `disable`, `focus`, `reset`) steuern die Sichtbarkeit/den Zustand des gesamten Menüs. Format und Semantik: [inputs.md](../concepts/inputs.md).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht** (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-menu` hat einen Output-Port für Navigations-Events. Emittiert wird, wenn der
Nutzer auf ein Item mit Route/Pfad klickt:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `navigate` | Nutzer klickt ein navigierbares Item | `event: "navigate"`, `params.path`, `clientId`, `sourceId`, `appId` | Route-Wechsel auslösen — typischerweise an eine `ui-action` mit `navigate`-Op verdrahten; alternativ `activeItem`-Store aktualisieren |

Items mit `href` (externe Links) lösen keinen `navigate`-Event aus — der Browser
öffnet den Link direkt.

**Antizipierte Wiring-Szenarien:**
- `navigate`-Output → `ui-action` (`navigate`, `to: msg.ui.params.path`) → navigiert zur gewählten Route. Gleichzeitig kann das `activeItem`-Binding aus einem Store gelesen werden, den eine `ui-route`-`onEnter`-Verdrahtung befüllt.
- `navigate`-Output → `function`-Knoten → `ui-store` (`set`, `path: "activeRoute"`) → `activeItem`-Binding liest denselben Wert → visuell aktives Item bleibt bei URL-getriebener Navigation synchron.

## Theming

`ui-menu` soll je nach `displayType` (`sidebar`/`topbar`) unterschiedliche
Strukturen rendern — heute jedoch **noch nicht** (kein Render-Unterschied, s.
„Darstellung"). Das Theme (Design-Tokens) wird von der Parent-App geerbt.
`displayType` ist kein semantischer Variant im Sinne von
[theming.md](../concepts/theming.md) — er steuert die Darstellungsform, nicht
die Semantik; deshalb liegt er im Feld `displayType`, nicht in `variant`.
Details: [theming.md](../concepts/theming.md).

## Referenzen

- [layout.md](../concepts/layout.md) — Child-Platzierungs-Felder und `app`-Layout-Slots
- [events.md](../concepts/events.md) — Event-Format und Output-Port-Semantik
- [inputs.md](../concepts/inputs.md) — `msg.payload`, `msg.ui.patch`, Component-Ops
- [stores.md](../concepts/stores.md) — Binding-Arten (`state`, `store`, `query`, `routeParam`)
- [theming.md](../concepts/theming.md) — `displayType` vs. `variant`
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker
- [`ui-route`](../structure/ui-route.md) — `onEnter`/`onLeave` für aktive-Item-Synchronisation

## Offene Punkte

- `displayType`-Render-Wirkung: `sidebar`/`topbar` sollen räumlich unterschiedlich rendern (sidebar vertikal, topbar horizontal), tun es aber noch nicht — Renderer/Adapter verzweigen nicht auf `displayType`. Noch nicht implementiert.
- `msg.payload`/`msg.ui.patch`-Konsum (Items-Ersatz bzw. Feld-Patch): heute Pass-Through; ob und wie das verdrahtet wird, ist die knotenübergreifende Frage aus P235 (ui-icon-`msg.payload`).
- Berechtigungsgesteuertes Ein- und Ausblenden einzelner Items (z. B. per `visibleIf`-Binding pro Item) ist noch nicht spezifiziert.
- Icon-Set-Konvention (Name → Asset-Auflösung) ist noch nicht festgelegt.
