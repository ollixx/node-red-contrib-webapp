# ui-route

Eine Unterseite der App — eine URL-Route mit eigenem Layout, optionalen
Parametern und einem Authz-Guard.

> English: [../../nodes/ui-route.md](../../nodes/ui-route.md)

## Zweck

`ui-route` definiert eine **Unterseite** der App: eine URL-Route mit eigenem
Layout. Pfade können Parameter tragen (`/customers/:id`), die als
`routeParam`-Bindings für die gemounteten View-Knoten bereitstehen. Die
Startseite `/` ist **keine** `ui-route`, sondern die implizite Root-Route der
[`ui-app`](ui-app.md); ein Pfad `/` ist verboten.

## Wann einsetzen

- Jede Seite jenseits der Startseite (`/customers`, `/customers/:id`, …).
- URL-Parameter einfangen und über `routeParam`-Bindings lesen.
- Seiten-Daten bei `onEnter` laden; bei `onLeave` aufräumen.
- Eine Seite per Gruppe schützen mit **Gruppen** (`requiresGroup`).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern; leer dient der `path` als Anzeige. | Freitext | `Route N` |
| **App** | Die Parent-`ui-app` aus dem App-Picker. Pflicht. | App-Referenz | — |
| **Pfad** (`path`) | Das URL-Segment (`/<root>/<path>`), Parameter via `:name`. App-weit eindeutig; nicht leer und nicht `/` (der Root-Route vorbehalten). Pflicht. | URL-Pfad | — |
| **Titel** (`title`) | Sprechender Routen-Titel (für Navigation/Breadcrumb). Voll bindbar. Ein **Literal** erscheint im Browser-Tab; eine dynamische Bindung wird zur Render-Zeit nicht aufgelöst (Tab zeigt die Routen-ID als Fallback). | beliebige Bindung | leer |
| **Parent Layout** (`layout`) | Layout-Preset der Route; legt Slots und Child-Platzierungs-Felder fest. | `vertical` / `horizontal` / `app` / `grid` / `absolute` | `vertical` |
| **Gruppen** (`requiresGroup`) | Kommaseparierte Gruppennamen — ein deklarativer Authz-Guard. Leer = nur Authentifizierung nötig; gesetzt = der User braucht **mindestens eine** der Gruppen (server-seitig erzwungen: direkter URL-Zugriff → 403). | Gruppennamen | leer |
| **Events** | Welche Lebenszyklus-Events feuern — jedes aktive Event erzeugt einen Output-Port. | `onEnter` / `onLeave` | keine |

## Eingang

`ui-route` wird von der Runtime bedient — meist verdrahtet man nichts. Intern
empfängt die Route Navigation zu ihr und Component-State-Messages für ihre
Kinder. **Adressierungs-Vorrang:** eine navigate-Message mit bereits explizitem
Ziel (`msg.ui.action.to`, aus Modus `route`/`url`) wird unverändert
durchgereicht — nur ein zielloses `wire`-navigate lässt die Route die Location
aus ihrem eigenen `path` bauen. Unbekannte/fachfremde Messages werden
unverändert durchgereicht.

## Ausgänge / Events

Ein Output-Port je aktivem Event:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `onEnter` | die Route wird betreten (Deep-Link, Refresh oder In-App-Navigate) | `event`, `route`, `params`, `clientId` |
| `onLeave` | die Route wird verlassen | `event`, `route`, `params`, `clientId` |

`params` trägt die aufgelösten Routenparameter (z. B. `{ id: "42" }` für
`/customers/:id`). Die Events feuern bei **jeder** Ankunft (der Client navigiert
stets per Full-Reload; der Server feuert den Lebenszyklus am Connect).

## Beispiele

### 1. Eine zweite Seite per Navigation erreichbar

Eine App mit Startseite und einer `ui-route` (`/details`); eine
`navigate`-Action auf der Startseite öffnet die Route, deren Content-Slot eine
Text-Zeile zeigt.

Flow-Datei: [`examples/guide/ui-route.json`](../../../../examples/guide/ui-route.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-route.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideRoute/` öffnen und **Go to details**
   klicken — die URL wird `/webapp/guideRoute/details`, die Detailseite rendert.

## Verwandt

- [`ui-app`](ui-app.md) — Parent und implizite Root-Route
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — Routen und Navigate-Modi
- [`ui-action`](ui-action.md) — Navigation auslösen
- Contract-Doc (intern, Deutsch): `docs/nodes/structure/ui-route.md`
