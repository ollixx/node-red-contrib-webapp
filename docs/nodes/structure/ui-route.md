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
| `title` | „Titel" | typedInput (literal/state/store/query/routeParam/msg/flow/global/jsonata/env) | optional | Sprechender Titel der Route (z. B. für Navigations-/Breadcrumb-Beschriftung). Literal-Bindungen erscheinen im Browser-Tab; dynamische Bindungen werden zur Render-Zeit nicht aufgelöst (Browser-Tab zeigt Routen-ID als Fallback). |

### Gruppe „Layout"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `layoutId` | „Layout" | SelectBox (Layout-Preset) | **ja** | Layout der Route (im Feld `layoutId` gespeichert). Auswahl aus den Standard-Presets (`vertical`, `horizontal`, `app`, `grid`, `absolute`). Default: `vertical`. Bestimmt die Slots und die Child-Platzierungs-Felder direkter Kinder — siehe [layout.md](../concepts/layout.md). |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `onEnter`, `onLeave`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-route"`-Hilfetext ist seit P89 vollständig: Zweck
(Unterseite/Route), Pfad-Regeln (Parameter `:id`, `/` verboten, App-weit
eindeutig), Titel-Bindung (alle Typen + Fallback-Verhalten), `onEnter`/`onLeave`
und Link auf die ausführliche Doku.

### Pfad-Info-Button (P89)

Das Pfad-Feld besitzt einen Info-Button (ⓘ), der einen jQuery-UI-Dialog mit den
Pfad-Regeln und einem Doku-Link öffnet — analog zum Logging-Info-Button in `ui-app`.

## Input

`ui-route` wird zur Laufzeit von der Runtime bedient — der Flow-Autor muss dafür
in der Regel nichts verdrahten.

- **Akzeptiert (intern zugestellt):**
  - **Navigation** zu dieser Route. Sie entsteht aus einer `navigate`-Action
    ([`ui-action`](../behavior/ui-action.md)). **Adressierungs-Vorrang (ADR 0011
    §3 / P118):** Trägt die eingehende navigate-msg bereits ein **explizites
    Ziel** (`msg.ui.action.to`, aus Modus `route`/`url` oder als Override), so
    behandelt die Route sie als **adressierte Navigation und reicht sie
    unverändert durch** — sie setzt NICHT ihren eigenen `path` darauf. Nur ein
    **zielloses** navigate (Modus `wire`, kein `to`) löst das Verhalten „Route
    baut die Location aus ihrem eigenen `path` + `params`" aus. Eine verdrahtete
    Route kapert also keine bereits adressierte Navigation. Format:
    [messages.md](../concepts/messages.md).
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

### Lebenszyklus an JEDER Ankunft (Connect-basiert, P112)

`onEnter`/`onLeave` feuern bei **jeder** Ankunft an der Route — Deep-Link,
Refresh und (Reload-basierter) In-App-Navigate gleichermaßen, nicht nur beim
programmatischen Navigate. Der Client navigiert immer per Full-Reload, also endet
jede Ankunft in einem neuen Page-Load + neuem SSE-Connect an der Ziel-Location;
der Server feuert den Lebenszyklus **am Connect**.

- **Betreten:** Sobald ein Client per Page-Load an der Location der Route ankommt.
  Für die implizite Wurzel `/` feuert `onEnter` auf der [`ui-app`](ui-app.md), wenn
  diese das Event deklariert.
- **Verlassen:** Wenn der Client zu einer anderen Location wechselt (Full-Reload →
  `onLeave` der alten Route, dann `onEnter` der neuen) **oder** den Client
  endgültig schließt (Disconnect ohne Reconnect innerhalb einer kurzen
  Grace-Periode).
- **Reconnect-sicher (Load-Nonce):** Der Client schickt pro Page-Load eine frische,
  nicht persistierte Nonce (`load`) am Stream-Connect mit. Gleiche Nonce =
  transienter `EventSource`-Reconnect → **kein** Lebenszyklus-Event; neue Nonce =
  echter Page-Load → `onEnter` (und ggf. `onLeave` der vorherigen Location).
- **Refresh:** Neuladen derselben Route (neue Nonce, gleiche Location) feuert
  `onEnter` erneut, **ohne** `onLeave`.
- Der programmatische `navigate` löst nur den Reload aus; den Lebenszyklus besitzt
  ausschließlich der Connect-Pfad (kein Doppel-`onEnter`).

**Bestehende Limitierung (Multi-Tab):** Die `clientId` liegt pro App in
localStorage und wird über alle Tabs derselben App geteilt; Per-Client-
Location-Tracking kollidiert daher zwischen mehreren Tabs derselben App. Noch
nicht gelöst (ggf. eigenes Paket: per-Tab-Id).

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
