# `ui-route`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-route` definiert eine **Unterseite** der App: eine URL-Route mit eigenem
Layout. Pfade können Parameter tragen (`/customers/:id`); die aufgelösten
Parameter stehen im Binding-Modell als `routeParam`-Bindings zur Verfügung. Die
Startseite `/` ist **nicht** Sache von `ui-route`, sondern der impliziten
Root-Route des [`ui-app`](ui-app.md).

## Einordnung

- **Parent:** genau eine `ui-app`.
- **Kinder:** View-Knoten mounten über `mount` in die Slots der Route (`route:<id>/content`, je nach Preset weitere Slots).
- **Erreichbarkeit:** `/<root>/<path>` der Parent-App.
- **Rolle zur Laufzeit:** der Renderer ermittelt aus dem Pfad die aktive Route und ihre Parameter; Root- und `ui-route`-Routing verhalten sich gleich.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Route N`; ist er leer, dient der `path` als Fallback-Anzeige. |
| `parent` | „App" | Node-Picker-Dialog (Preset Apps) | **ja** | Die Parent-`ui-app`. Auswahl aus einer filter- und scrollbaren Liste der Apps. |
| `path` | „Pfad" | Textfeld | **ja** | Das URL-Segment der Route (`/<root>/<path>`), Parameter via `:name`. Eindeutig **innerhalb derselben App**. Darf **nicht leer** und **nicht `/`** sein — `/` ist der impliziten Root-Route vorbehalten. |
| `title` | „Titel" | Textfeld | optional | Sprechender Titel der Route (z. B. für Navigations-/Breadcrumb-Beschriftung). |

### Gruppe „Layout"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `layout` | „Layout" | SelectBox (Layout-Preset) | **ja** | Layout der Route. Auswahl aus den Standard-Presets (`vertical`, `horizontal`, `app`, `grid`, `absolute`). Default: `vertical`. Bestimmt die Slots und die Child-Platzierungs-Felder direkter Kinder — siehe [layout.md](../concepts/layout.md). |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `onEnter`, `onLeave`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-route"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Unterseite/Route), die Pfad-Regeln (Parameter `:id`, `/` verboten,
App-weit eindeutig), ein Hinweis auf `onEnter`/`onLeave` und ein Link auf die
ausführliche Doku. Empfohlener Link (später ggf. Wiki):
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/structure/ui-route.md`.

## Input

`ui-route` wird zur Laufzeit von der Runtime bedient — der Flow-Autor muss dafür
in der Regel nichts verdrahten.

- **Akzeptiert (intern zugestellt):**
  - **Navigation** zu dieser Route. Sie entsteht aus einer `navigate`-Action
    ([`ui-action`](../behavior/ui-action.md)) — entweder durch eine an die Route
    **verdrahtete** Action (Szenario 1, Pfad aus dem eigenen `path` + `params`)
    oder über ein app-global aufgelöstes `to` (Szenario 2). Format: [messages.md](../concepts/messages.md).
  - **Component-State-Messages** für ihre Kind-Elemente (`show`/`hide` etc.),
    ebenfalls über die Runtime geroutet.
- **Validierung:** der Pfad `/` ist verboten und Pfade müssen je App eindeutig
  sein — geprüft zur Deploy-Zeit (die Eindeutigkeit ist per-Knoten im Editor nicht
  sichtbar, daher Compile-/Deploy-Validierung).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird beim Eintritt/Austritt der Route:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `onEnter` | die Route wird betreten | `event: "onEnter"`, `route`, `params`, `clientId` | Seiten-Daten laden (z. B. Datensatz zu `params.id`) |
| `onLeave` | die Route wird verlassen | `event: "onLeave"`, `route`, `params`, `clientId` | Aufräumen / Verwerfen von Seiten-Zustand |

`route` trägt die betretene/verlassene Location; `params` die aufgelösten
Routenparameter (z. B. `{ id: "42" }` für `/customers/:id`). Feld-Details:
[events.md](../concepts/events.md).

**Antizipierte Wiring-Szenarien:**
- `onEnter` → `ui-query`/`function`, das die Daten der Seite lädt und in einen
  `ui-store` schreibt; gezielt per `msg.ui.clientId`, falls nur der navigierende
  Client betroffen ist.
- `onLeave` → Aufräumen (Entwurf verwerfen, Auswahl zurücksetzen).

## Theming

`ui-route` rendert selbst keine sichtbare Chrome — es ordnet über sein
Layout-Preset nur die Slots an. Das Theme wird von der Parent-App geerbt; es gibt
hier keine eigenen Theming-Felder. Siehe [theming.md](../concepts/theming.md).

## Besonderheiten

- **Die Root-Route `/` gehört `ui-app`.** `ui-route` ist nur für Unterseiten; ein
  `path: "/"` ist verboten (Kollision mit der impliziten Root-Route).
- **Route-Parameter** (`:name`) werden als `routeParam`-Bindings für die
  gemounteten View-Knoten verfügbar gemacht (siehe [stores.md](../concepts/stores.md)
  für die Binding-Arten).

## Referenzen

- [`ui-app`](ui-app.md) — Parent und implizite Root-Route
- [layout.md](../concepts/layout.md) — Presets und Slots
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [messages.md](../concepts/messages.md) — Navigation
- [`ui-action`](../behavior/ui-action.md) — Navigation auslösen

## Offene Punkte

- Route-Guards, Loader, Titelauflösung und verschachtelte Routen sind noch nicht modelliert.
- Die Beziehung zwischen Route- und Query-Lebenszyklus ist noch nicht explizit modelliert.
