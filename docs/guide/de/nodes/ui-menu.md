# ui-menu

Ein Navigationsmenü, das dem Nutzer die App-Routen zugänglich macht.

> English (canonical): [nodes/ui-menu.md](../../nodes/ui-menu.md)

## Zweck

`ui-menu` rendert ein **Navigationsmenü** — eine Liste von Einträgen, die der
Nutzer anklickt, um sich in der App zu bewegen. Die Einträge kommen aus einer
bindbaren `items`-Quelle (ein statisches Array oder ein Store/State-Binding); die
aktuell aktive Route kann aus einem zweiten Binding hervorgehoben werden. Ein
Klick auf einen navigierbaren Eintrag emittiert ein `navigate`-Event auf dem
Output-Port, das an eine [`ui-action`](ui-action.md) verdrahtet wird, um die
Route tatsächlich zu wechseln.

## Wann einsetzen

- Die Hauptnavigation einer App bauen — typischerweise in einem `navbar`- oder
  `header`-Slot eines `app`-Layout-Parents.
- Das Menü aus Daten speisen (ein Store-Binding), damit sich die Einträge mit dem
  App-Zustand ändern.
- Für eine Positions-Spur, die zeigt *wo* der Nutzer ist, stattdessen
  [`ui-breadcrumb`](ui-breadcrumb.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Menu N` |
| **Parent Slot** (`mount`) | Slot, in den das Menü mountet. Pflicht. | Mount-Pfad | — |
| **Display Type** (`displayType`) | Benennt den geplanten räumlichen Modus. **Ehrlicher Hinweis:** heute rendern beide Werte ein identisches nacktes Menü — die Sidebar-/Topbar-Modi sind *geplant*, aber noch nicht umgesetzt; der Renderer verzweigt nicht auf dieses Feld. | `sidebar`, `topbar` | `sidebar` |
| **Items** (`items`) | Die Menü-Einträge — ein statisches Array oder ein Binding. Jedes Item: `{ "label": …, "route"?: …, "href"?: …, "path"?: …, "icon"?: …, "children"?: [...] }` (eines von `route`/`href`/`path`). Das Menü rendert seine Einträge selbst (kein Slot pro Item). Pflicht. | `literal`/`json` (statisches Array), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | — |
| **Active Route** (`activeRoute`) | Lesendes Binding auf den Pfad/die Route des aktiven Items; der passende Eintrag wird hervorgehoben. Typisch an einen Store-Wert gebunden, der beim `onEnter` einer Route gesetzt wird. | wie Items | — |
| **Visible** (`visible`) | Basis-Feld — deklarative Sichtbarkeit (bindbarer Boolean). | Boolean-Binding | sichtbar |
| **Disabled** / **Color** | Basis-Felder. | — | — |

`Size` ist N/A (dieser Knoten hat keine Größen-Stufen). Ein Legacy-Darstellungstyp
`dropdown` wurde entfernt (kein Trigger-Modell); ein deployter `dropdown`-Wert
fällt auf `sidebar` zurück.

## Eingang

`ui-menu` **hat einen Eingangs-Port**, konsumiert aber heute **weder
`msg.payload` noch `msg.ui.patch`** — beide werden **unverändert durchgereicht**
(ein Items-Ersatz oder Feld-Patch per Nachricht ist noch nicht verdrahtet).

- **Interaktions-Verben** (`msg.ui.action.type`): `show`, `hide`, `select` — von
  einer verdrahteten `ui-action` dispatcht.
- **`msg.ui.component.op`** (`show`, `hide`, …) — schaltet die Sichtbarkeit des
  ganzen Menüs.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

`ui-menu` hat einen Output-Port. Emittiert wird beim Klick auf ein Item mit
Route/Pfad:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `navigate` | Nutzer klickt ein navigierbares Item | `event: "navigate"`, `params.path`, `clientId`, `sourceId`, `appId` |

Items mit `href` (externe Links) emittieren **kein** `navigate` — der Browser
öffnet den Link direkt. Verdrahte `navigate` → `ui-action` (`navigate`,
`to: msg.ui.params.path`) für den Route-Wechsel.

## Beispiele

### 1. Ein Sidebar-Menü mit aktivem Eintrag

Ein Menü mit drei Einträgen (Home, Customers, Settings), bei dem die aktive Route
aus einem Store-Wert hervorgehoben wird.

Flow-Datei: [`examples/guide/ui-menu.json`](../../../../examples/guide/ui-menu.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-menu.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideMenu/` öffnen — ein Menü mit drei
   Einträgen erscheint, „Customers" als aktiv hervorgehoben.

## Verwandt

- [`ui-breadcrumb`](ui-breadcrumb.md) — eine Positions-Spur
- [Navigation & Dialoge](../guides/navigation-dialogs.md) — Routen und die Navigate-Modi
- [`ui-action`](ui-action.md) — macht aus einem `navigate`-Event einen Route-Wechsel
- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-menu.md`
