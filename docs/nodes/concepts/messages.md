# Message-Formate

## Allgemeines Nachrichtenformat

Alle Messages zwischen Webapp-Knoten tragen ein `msg.ui`-Objekt. Dieses enthält immer:

- `msg.ui.appId`: ID der App, zu der die Message gehört
- `msg.ui.clientId` _(optional)_: Ziel-Client. Fehlt der Wert, gilt die Message für alle verbundenen Clients der App.

---

## Eingehende Component-State-Messages

Alle View-Knoten (`ui-button`, `ui-input`, `ui-text`, `ui-table`, `ui-container`) akzeptieren eingehende Messages zur Zustandssteuerung. Das Format ist identisch mit dem, was `ui-action` auf seinem Out-Port emittiert — der App-Autor verdrahtet den Out-Port von `ui-action` direkt mit dem In-Port des Ziel-Knotens.

```
msg.ui.component.id   = <nodeId des Zielknotens>
msg.ui.component.op   = "show" | "hide" | "enable" | "disable" | "focus" | "reset"
msg.ui.clientId       = <optional: nur für diesen Client>
```

### Verfügbare Operationen

| `op` | Beschreibung | Gilt für |
|---|---|---|
| `show` | Blendet das Element ein | alle View-Knoten |
| `hide` | Blendet das Element aus | alle View-Knoten |
| `enable` | Aktiviert das Element | `ui-button`, `ui-input` |
| `disable` | Deaktiviert das Element | `ui-button`, `ui-input` |
| `focus` | Setzt den Fokus | `ui-input` |
| `reset` | Setzt den Wert auf den Initialwert zurück | `ui-input` |

Unbekannte `op`-Werte werden ignoriert. Fehlende `msg.ui.component.id` → Message wird verworfen.

### Verhältnis zu `ui-action`

`ui-action` mit `targetMode: out-port` emittiert exakt dieses Format auf seinem Out-Port. Der App-Autor verdrahtet den Out-Port mit dem Ziel-Knoten — kein separates Message-Konzept, kein doppeltes Format.

`ui-action` mit `targetMode: path` übernimmt das Routing zur Laufzeit und schickt die Message intern an den richtigen Knoten, ohne explizite Flow-Verdrahtung.

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
