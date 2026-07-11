# `ui-menu`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-menu` rendert ein **Navigationsmenü**, das die App-Routen für den Nutzer
zugänglich macht. Die Menü-Items werden statisch konfiguriert oder über ein
Binding aus dem App-State bezogen; das aktive Item (die aktuelle Route) kann
ebenfalls über ein Binding gesteuert werden. Durch `displayType` wird bestimmt,
wie das Menü räumlich dargestellt wird — als Seitenleiste, als Kopfzeile oder
als ausklappbares Dropdown.

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
| `displayType` | „Display Type" | SelectBox | optional | Darstellungstyp des Menüs (kein semantischer Variant, sondern ein Präsentationsmodus): `sidebar` (vertikale Seitenleiste, Default), `topbar` (horizontale Kopfzeile), `dropdown` (ausklappbares Kontextmenü). Jeder Modus kann das Layout und die Interaktion des Menüs wesentlich verändern. |

### Gruppe „Items"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `items` | „Items State Path" | typedInput (Binding) | **ja** | Die Menü-Einträge. Kann ein **statisches Array** oder ein **Binding** sein. Jedes Item hat die Form `{ "label": "<anzeigename>", "route"?: "<route-pfad>", "href"?: "<externer-link>", "path"?: "<pfad>", "icon"?: "<icon-name>", "children"?: [...] }`. Ein Item kann entweder `route` (interne Navigation), `href` (externer Link) oder `path` tragen — nicht mehrere. Kinder-Items (`children`) haben dieselbe Struktur ohne weiteren `children`-Level. Bindbare Arten: `state`, `store`, `query`, `routeParam`, `literal` sowie Node-RED-Standard-Arten (`msg`, `flow`, `global`, `jsonata`, `env`). |
| `activeRoute` | „Active Route Path" | typedInput (Binding) | optional | Binding auf den Pfad/die Route des aktuell aktiven Items (im Feld `activeRoute` gespeichert, typedInput-Carrier `activeRouteBinding`). Das Menü hebt das passende Item visuell hervor. Typischerweise an einen Store-Wert gebunden, der beim `onEnter` einer Route gesetzt wird. Bindbare Arten wie `items`. |
| `collapsed` | — | typedInput (Binding) | optional | Binding auf einen Boolean; steuert bei `displayType: sidebar` den eingeklappten Zustand der Seitenleiste. `true` = eingeklappt (nur Icons sichtbar), `false` = ausgeklappt. Bindbare Arten wie `items`. |

### Gruppe „Layout" (Child-Platzierung im Parent)

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlenfeld | optional | Reihenfolge im `horizontal`/`vertical`-Layout-Parent. Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` / `colSize` / `rowSize` | „Row" / „Col" / „Col Size" / „Row Size" | Zahlenfelder | optional | Platzierung und Größe im `grid`-Layout-Parent (1-basiert). |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfelder | optional | Absolute Position im `absolute`-Layout-Parent. |

Sichtbarkeit dieser Felder folgt dem Layout-Preset des jeweiligen Parents — gesteuert durch `installLayoutChildPropRows()`. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-menu"`-Hilfetext soll knapp sein: Zweck (Navigationsmenü),
Hinweis auf `displayType` (`sidebar`/`topbar`/`dropdown`), Items-Format
(`label`/`route`/`icon`/`children`) und `activeItem`-Binding sowie ein Link auf
die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/navigation/ui-menu.md`.

## Input

- **`msg.payload`** — ersetzt die Items-Liste vollständig; erwartet wird ein Array von Menu-Item-Objekten (s. o.). Binding-gebundene Items werden bei der nächsten Binding-Auflösung wieder überschrieben.
- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition (z. B. `items`, `activeItem`, `collapsed`, `displayType`). Binding-Felder müssen als Binding-Objekt übergeben werden. Format: [inputs.md](../concepts/inputs.md).
- **Component-Operationen** (`msg.ui.component.op`): `show`, `hide` steuern die Sichtbarkeit des gesamten Menüs. Format und Semantik: [inputs.md](../concepts/inputs.md).
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
- `collapsed`-Binding aus einem `ui-store` → Button (`ui-button`) toggled den Store-Wert → Sidebar klappt ein/aus.

## Theming

`ui-menu` rendert je nach `displayType` sehr unterschiedliche Strukturen
(Seitenleiste, horizontale Leiste, Dropdown). Das Theme (Design-Tokens) wird von
der Parent-App geerbt. `displayType` ist kein semantischer Variant im Sinne von
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

- `dropdown`-Modus: Wer öffnet das Dropdown (Trigger-Element)? Die Beziehung zu einem auslösenden `ui-button` ist noch nicht modelliert.
- Berechtigungsgesteuertes Ein- und Ausblenden einzelner Items (z. B. per `visibleIf`-Binding pro Item) ist noch nicht spezifiziert.
- Icon-Set-Konvention (Name → Asset-Auflösung) ist noch nicht festgelegt.
