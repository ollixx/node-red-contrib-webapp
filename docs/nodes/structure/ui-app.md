# `ui-app`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-app` ist die **Wurzel** einer deklarativen Web-App. Der Knoten definiert die
Basis-URL, das Basis-Layout, das Theme (Design-Tokens) und das Logging-Verhalten
der App. Er ist zugleich die **implizite Root-Route `/`**: Startseiten-Inhalte
werden direkt in seine Layout-Slots gehängt — eine einfache App braucht keinen
einzigen `ui-route`-Knoten.

## Einordnung

- **Parent:** keiner — `ui-app` ist der Root-Knoten.
- **Kinder:** View-Knoten mounten über `mount` in die App-Slots (`<appId>/content`, beim `app`-Preset zusätzlich `header`/`navbar`/`footer`). `ui-route`-Knoten referenzieren die App als Parent.
- **Erreichbarkeit:** die App wird unter `/<root>` ausgeliefert (eindeutiger URL-Einstieg).
- **Rolle zur Laufzeit:** Einstiegspunkt für Runtime-API, Renderer und Editor-Strukturansicht; SSE-Hub für den Live-Transport (siehe [messages.md](../concepts/messages.md)).

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (SelectBox,
Node-Picker-Dialog, typedInput, Token-Editor, Event-Checkboxen).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `App N`. |
| `root` | „Root" | Textfeld + URL-Vorschau | **ja** | Erster URL-Abschnitt der App (`/<root>`). Eindeutig über alle `ui-app`-Knoten; nur valide URL-Path-Zeichen. Eine Live-Vorschau zeigt die resultierende App-URL. |

### Gruppe „Layout"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `layout` | „Layout" | SelectBox (Layout-Preset) | **ja** | Basis-Layout der App. Auswahl aus den Standard-Presets (`vertical`, `horizontal`, `app`, `grid`, `absolute`). Default: `vertical`. Bestimmt die verfügbaren Slots und die Child-Platzierungs-Felder direkter Kinder — siehe [layout.md](../concepts/layout.md). |

### Gruppe „Theming"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `tokens` | „Styles anpassen" | Button → Token-Editor-Dialog | optional | App-weite Design-Tokens (Farben, Typografie, Abstände, Radii). Nicht gesetzte Tokens fallen auf System-Defaults zurück; das Theme ist additiv. Details und Token-Liste: [theming.md](../concepts/theming.md). |

### Gruppe „Logging"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `forwardErrorsToClient` / `forwardErrorMinSeverity` | „Logging" (+ Info-Icon-Dialog) | **eine** SelectBox: `aus` / `debug` / `info` / `warn` / `error` | optional | Steuert die opt-in Weiterleitung von **Framework-Fehlern** des Backends an verbundene Clients. `aus` (Default) = keine Weiterleitung. Eine Severity schaltet die Weiterleitung ein und setzt zugleich die Mindeststufe. Weitergeleitete Meldungen werden redigiert. Mapping und Sicherheitsbegründung: [logs-errors.md](../concepts/logs-errors.md). |

### Gruppe „Medien"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `mediaStoreUrl` | „Media Store URL" | Textfeld | optional | Basis-URL eines Medien-Speichers. Ist sie gesetzt, können Bilder als `asset:<id>` referenziert werden (z. B. in `ui-image.src`). Der Client greift **nie** direkt auf den Store zu — die Auflösung läuft über einen app-skopierten Node-RED-Backend-Proxy (`/webapp/<appId>/asset/<id>`), der die echte Store-URL serverseitig hält und das Asset streamt (Obfuskation). Leer = keine `asset:`-Referenzen. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `clientConnected`, `clientDisconnected`, `onEnter`, `onLeave`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-app"`-Hilfetext im Editor soll **knapp, aber
ausreichend** sein: Zweck in 1–2 Sätzen, die Rolle als Root + implizite
Root-Route, ein Hinweis pro Feldgruppe (Root/Layout/Theming/Logging/Events) und
ein Link auf die ausführliche Doku. Empfohlener Link (später ggf. Wiki):
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/structure/ui-app.md`.

## Input

`ui-app` konsumiert **keine fachlichen** Eingangs-Messages — es ist primär eine
Ereignis-Quelle und der SSE-Hub der App.

- **Akzeptiert:** keine speziellen `msg.ui.*`-Verben.
- **Validierung:** keine (keine fachlichen Verben zu prüfen).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe. Es gilt die Framework-Regel: kein stilles
  Schlucken, aber auch keine Fehlermeldung für irrelevante Eingaben.
- **Framework-Fehler** (z. B. fehlgeschlagener Snapshot-Aufbau) werden gemäß
  [logs-errors.md](../concepts/logs-errors.md) als strukturierter Fehler gemeldet,
  nicht als gewöhnliche Eingabe behandelt.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird, wenn das jeweilige Ereignis
zur Laufzeit eintritt:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `clientConnected` | ein Client öffnet die App (neue Session) | `event: "clientConnected"`, `clientId` | initiale Daten für genau diesen Client laden und per `clientId` gezielt zustellen |
| `clientDisconnected` | ein Client schließt die App / verliert die Verbindung | `event: "clientDisconnected"`, `clientId` | Aufräumen / Sitzungs-Ende verbuchen |
| `onEnter` | die implizite Root-Route `/` wird betreten | `event: "onEnter"`, `route`, `params`, `clientId` | Startseiten-Daten laden |
| `onLeave` | die implizite Root-Route `/` wird verlassen | `event: "onLeave"`, `route`, `params`, `clientId` | Aufräumen beim Verlassen der Startseite |

Feldsemantik der Lifecycle-Events (`route`/`params`) wie bei `ui-route` —
siehe [events.md](../concepts/events.md).

**Antizipierte Wiring-Szenarien:**
- `clientConnected` → `function`/`ui-query`/`ui-store`, das den initialen
  Zustand baut, mit `msg.ui.clientId` **gezielt** an den neuen Client (nicht
  Broadcast) — siehe [multi-user.md](../concepts/multi-user.md).
- `onEnter` der Root → Laden der Startseiten-Daten in einen `ui-store`/`ui-query`.
- Eine an `ui-app` verdrahtete `navigate`-Action navigiert zur Root `/` und löst
  `onEnter`/`onLeave` aus (ADR 0007 Amendment).

## Theming

`ui-app` ist der Ort, an dem das **App-weite Theme** (Design-Tokens) gesetzt wird;
es gilt für alle gerenderten Komponenten. Die Tokens sind backend-neutral und
werden vom aktiven Renderer-Backend auf dessen Variablen abgebildet (heute
Shoelace; weitere Backends wie Material o. ä. sind vorgesehen und bilden dieselben
semantischen Tokens auf ihr jeweiliges System ab). Details: [theming.md](../concepts/theming.md).

## Render-Semantik (P109)

### HTML-`<title>`
Das `<title>`-Element im Browser-Tab wird immer aus dem `name`-Feld der App
gesetzt (Format: `<name> — <Routen-Titel>`).

### Header-Slot und App-Bar
Bei Verwendung des `app`-Layouts zeigt die App-Bar oben im Fenster:

- **Header-Slot leer** (kein Kind im `header`-Slot der App): Der `name` der App
  erscheint als Titeltext in der App-Bar.
- **Header-Slot belegt** (≥1 Kind im `header`-Slot): Die Slot-Kinder werden
  gerendert; die App-Bar zeigt **keinen** eigenen `name`-Titel — der Slot
  übernimmt vollständig die Kontrolle über den Header-Bereich.

**Hinweis:** Soll der HTML-`<title>` vom `name` abweichen (z. B. für SEO), wäre
ein eigenes `title`-Feld nötig — das ist bewusst **nicht** in P109 enthalten und
bleibt ein optionaler späterer Ausbauschritt.

## Besonderheiten

- **Implizite Root-Route `/`.** `ui-app` ist zugleich die Route `/`. View-Knoten
  können direkt in die App-Slots gehängt werden; ein `ui-route` mit `path: "/"` ist
  **verboten** (Kollision) — siehe [`ui-route`](ui-route.md). Root-Routing und
  `ui-route`-Routing verhalten sich gleich (gemeinsamer Pfad).
- **Mehrere Apps** pro Node-RED-Instanz sind zulässig; jede hat eine eindeutige
  `root`.

## Referenzen

- [overview.md](../concepts/overview.md) — gemeinsame Modellregeln
- [layout.md](../concepts/layout.md) — Presets und Slots
- [theming.md](../concepts/theming.md) — Design-Tokens und Backends
- [logs-errors.md](../concepts/logs-errors.md) — Logging/Fehler-Weiterleitung
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [multi-user.md](../concepts/multi-user.md) — `clientId`-Routing
- [`ui-route`](ui-route.md) — Unterseiten

## Offene Punkte

- App-weite Metadaten wie Authentifizierung/Autorisierung (z. B. OAuth2/OIDC) sind noch nicht modelliert.
