# ui-app

Die Wurzel einer deklarativen Web-App — Basis-URL, Layout, Theme, Auth und
Lebenszyklus-Events.

> English: [../../nodes/ui-app.md](../../nodes/ui-app.md)

## Zweck

`ui-app` ist die **Wurzel** einer Web-App. Der Knoten definiert die Basis-URL,
das Basis-Layout, das Theme (Design-Tokens), das Logging-Verhalten, die
Authentifizierung und die Lebenszyklus-Events der App. Er ist zugleich die
**implizite Root-Route `/`**: Startseiten-Inhalte mounten direkt in die
Layout-Slots der App — eine einfache App braucht keinen `ui-route`-Knoten. Die
App wird unter `/webapp/<root>` ausgeliefert.

## Wann einsetzen

- Immer — jede deklarative Web-App beginnt mit genau einer `ui-app`.
- Startseiten-Inhalt direkt in die App-Slots hängen (kein `ui-route` für `/`).
- Eine `ui-app` pro App; mehrere Apps je Node-RED-Instanz sind erlaubt, jede
  mit eigenem, eindeutigem `root`.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor; zugleich Browser-Tab-Titel und App-Bar-Titel, wenn der Header-Slot leer ist. | Freitext | `App N` |
| **Root** | URL-Abschnitt hinter dem festen `/webapp/`-Präfix — die App ist unter `/webapp/<root>` erreichbar. Eindeutig über alle Apps; nur URL-Path-Zeichen. Eine Live-Vorschau zeigt die URL. Pflicht. | URL-Segment | — |
| **Layout** | Basis-Layout-Preset; bestimmt die Slots und die Child-Platzierungs-Felder direkter Kinder. | `vertical` / `horizontal` / `app` / `grid` / `absolute` | `vertical` |
| **Styles anpassen** (`tokens`) | App-weite Design-Tokens (Farben, Typografie, Abstände, Radii), im Dialog gesetzt. Nicht gesetzte Tokens fallen auf System-Defaults zurück; das Theme ist additiv und wird von allen Komponenten geerbt. | Token-Map | System-Defaults |
| **Logging** (`forwardErrorsToClient` / `forwardErrorMinSeverity`) | Opt-in-Weiterleitung von **Framework-Fehlern** an Clients ab der gewählten Stufe. Weitergeleitetes wird redigiert. `aus` ist der sichere Default. | `aus` / `debug` / `info` / `warn` / `error` | `aus` |
| **Auth** (`auth`) | Authentifizierungs-Modus. `none` lässt die App offen; `trusted-header` erzwingt die Identität auf jedem App-Endpoint (aus Reverse-Proxy-Headern) und stellt sie als Binding-Quelle `user` bereit. Die Header-/Redirect-Zeilen erscheinen bei `trusted-header`. | `none` / `trusted-header` (+ Header, Redirect) | `none` |
| **Media Store URL** (`mediaStoreUrl`) | Basis-URL eines Medien-Speichers; gesetzt können Bilder als `asset:<id>` referenziert werden (über einen App-Proxy aufgelöst, nie direkt vom Client). | URL | leer |
| **Events** | Welche Lebenszyklus-Events feuern — jedes aktive Event erzeugt einen Output-Port. | `clientConnected` / `clientDisconnected` / `onEnter` / `onLeave` | keine |
| **Status** (`deployMode`) | Wie ein Deploy die Clients erreicht. `Entwicklung` liefert das frisch kompilierte Modell automatisch aus; `Produktion` zeigt einen Versions-Alert und wartet auf den manuellen Reload. | `Entwicklung` / `Produktion` | `Entwicklung` |

## Eingang

`ui-app` hat einen Eingangs-Port, damit die App-globalen Verben `navigate` und
`reset` an ihn verdrahtet (oder gepickt) werden können wie an jedes Ziel — ein
an die App verdrahtetes `navigate` navigiert zur Root `/`. Fachliche Messages
konsumiert der Knoten **nicht**: unbekannte/fachfremde Messages werden
**unverändert durchgereicht**. Framework-Fehler (z. B. ein fehlgeschlagener
Snapshot-Aufbau) werden als strukturierte Fehler gemeldet, nicht als Eingabe.

## Ausgänge / Events

Ein Output-Port je aktivem Event, in Listenreihenfolge:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `clientConnected` | ein Client öffnet die App (neue Session) | `event`, `clientId` |
| `clientDisconnected` | ein Client schließt / verliert die Verbindung | `event`, `clientId` |
| `onEnter` | die implizite Root-Route `/` wird betreten | `event`, `route`, `params`, `clientId` |
| `onLeave` | die Root-Route `/` wird verlassen | `event`, `route`, `params`, `clientId` |

`clientConnected` / `onEnter` zum Laden der Startdaten nutzen — gezielt an den
neuen Client per `msg.ui.clientId`, nicht per Broadcast.

## Beispiele

### 1. Minimal-App mit Startseite

Eine `app`-Layout-App mit Header und einer Inhalts-Zeile — die App-Bar zeigt
den App-Namen, der Content-Slot eine Begrüßung.

Flow-Datei: [`examples/guide/ui-app.json`](../../../../examples/guide/ui-app.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-app.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideApp/` öffnen — App-Bar und
   „Welcome to the app" erscheinen.

## Verwandt

- [Getting started](../getting-started.md) — die erste App von A bis Z
- [Layout & Slots](../guides/layout-slots.md) — Presets und Mount-Pfade
- [Theming & Components](../guides/theming-components.md) — Design-Tokens
- [Auth](../guides/auth.md) — trusted-header-Betrieb und das `user`-Binding
- [`ui-route`](ui-route.md) — Unterseiten
- Contract-Doc (intern, Deutsch): `docs/nodes/structure/ui-app.md`
