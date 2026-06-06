# Message-Formate

## Allgemeines Nachrichtenformat

Alle Messages zwischen Webapp-Knoten tragen ein `msg.ui`-Objekt. Dieses enthält immer:

- `msg.ui.appId`: ID der App, zu der die Message gehört
- `msg.ui.clientId` _(optional)_: Ziel-Client. Fehlt der Wert, gilt die Message für alle verbundenen Clients der App.

---

## Action-Messages (`msg.ui.action`)

Interaktions-Kommandos (Sichtbarkeit, Aktivierung, Offenlegung, Navigation,
Fokus, Reset) reisen einheitlich als **`msg.ui.action`**. Das ist ein
öffentlicher, schema-validierter Contract (`actionMessageSchema` in
`packages/schema`, [ADR 0007](../../adr/0007-action-message-and-per-node-interaction-handlers.md)):

```
msg.ui.action.type   = <verb>              ← siehe Verbset in actions.md
msg.ui.action.to     = "/route/path"       ← nur navigate (optional)
msg.ui.action.part   = "<sub-id>"          ← open/close/select (optional)
msg.ui.action.target = "<node-/component-id>"  ← optionaler Override
msg.ui.clientId      = <optional: nur für diesen Client>
```

Das Schema validiert **nur** `msg.ui.action`; alle übrigen `msg.*`- und
`msg.ui.*`-Felder werden unangetastet durchgereicht. Weil es ein gewöhnlicher
Message-Contract ist, kann **jeder** Knoten ihn erzeugen — `ui-action` ist nur
der bequeme, typisierte Emitter. Der App-Autor verdrahtet den Out-Port von
`ui-action` direkt mit dem In-Port des Zielknotens; der Zielknoten verarbeitet
das ihm bekannte Verb und reicht die Message sonst durch.

### Verfügbare Verben

| Verb | Beschreibung | Gilt für |
|---|---|---|
| `show` / `hide` | Element ein-/ausblenden | alle View-Knoten |
| `open` / `close` | Offenlegung (Dialog/Drawer/Accordion/…) | aufklappbare Elemente |
| `select` | Einzelauswahl unter Geschwistern | Tab, Stepper, Menü |
| `enable` / `disable` | Element aktivieren/deaktivieren | `ui-button`, `ui-input` |
| `focus` | Fokus setzen | `ui-input` |
| `reset` | Wert auf Initialwert zurücksetzen | `ui-input` |
| `navigate` | Client zu einer Route navigieren | `ui-app`, `ui-route` |

Ein Verb, das ein Zielknoten nicht kennt → Pass-Through (kein stilles Schlucken).
Das vollständige Verbset und die Zieladressierung stehen in
[actions.md](./actions.md).

---

## Navigation-Messages

Erzeugt von `ui-action` mit `actionType: navigate` oder von `ui-navigation`.

```
msg.ui.navigate.to        = "/customers/:id"
msg.ui.navigate.params    = { id: "42" }
msg.ui.clientId           = <optional>
```

`ui-route` empfängt diese Message intern über die Runtime. Der App-Autor muss sie nicht explizit verdrahten.

---

## Dialog-Messages

Öffnen und Schließen eines Dialogs direkt per Message (alternativ zu Store-State):

```
msg.ui.dialog.id     = <nodeId des ui-dialog>
msg.ui.dialog.op     = "open" | "close" | "toggle"
msg.ui.clientId      = <optional>
```

---

## Query-Messages

Eingehende Message an `ui-query` um Daten zu pushen oder einen Refresh auszulösen:

```
msg.ui.query.queryPath   = "customers.list"
msg.ui.query.data        = [...]            ← neue Daten (optional)
msg.ui.query.etag        = "2026-05-30T..."  ← für Caching (optional)
msg.ui.query.refresh     = true             ← Refresh ohne neue Daten (optional)
```

---

## Store-Messages

Siehe [ui-store.md](../state/ui-store.md) für das vollständige Format.

---

## Live-Transport (P30/P31)

Die gerenderte Oberfläche wird als framework-neutraler `RenderSnapshot` über
einen Live-SSE-Kanal an den Browser geliefert. Der schlanke Vanilla-JS-Client
(`resources/lib/webapp-client.js`) abonniert den SSE-Stream und empfängt dort
sowohl den initialen Snapshot als auch alle flow-getriebenen Updates.

### Endpunkte

```
GET  /webapp/:appId/stream?clientId=<id>&location=<route>
       → SSE-Stream; erstes Ereignis: snapshot { snapshot: RenderSnapshot }
         Folgeeignisse: snapshot (Store-Update) | command (ui-action-Interaktion)

POST /webapp/:appId/event   (Content-Type: application/json)
       → { message, location, snapshot }
```

### Event-Payload (Browser → Runtime)

Der Client schickt genau die Felder, die die `msg.ui`-Event-Message speisen:

```
{
  clientId : <Browser-Session-ID>                  ← Pflicht
  sourceId : <componentId der auslösenden Komponente>  → msg.ui.sourceId
  event    : "click" | "submit" | "select" | "change"  → msg.ui.event
  location : <aktuelle Route>                      → msg.ui.route
  params   : { ... }                               ← z.B. Formularwerte, rowId
}
```

Die Runtime nimmt **keine Domain-Aktion** vor — sie leitet das Event an den
Ursprungsknoten weiter, der es auf seinem Output-Port an den verdrahteten Flow
emittiert. Der Flow entscheidet, was passiert.

### Antwort auf POST /event

```
{
  message  : <die emittierte msg.ui-Event-Message>
  location : <aktuelle Route (unverändert)>
  snapshot : <aktueller RenderSnapshot (read-only re-render)>
}
```

### SSE-Ereignisse (Server → Browser)

```
event: snapshot
data: { snapshot: RenderSnapshot }   ← bei Store-Updates aus dem Flow

event: command
data: { command: { type, ... } }     ← bei ui-action-Interaktionsbefehlen
```

Der Client führt beim Re-Render einen **keyed Morph** durch: nur geänderte
Knoten werden ersetzt, sodass Fokus und Scroll-Position bei Listen-/State-Updates
erhalten bleiben.
