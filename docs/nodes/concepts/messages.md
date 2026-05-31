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

## Snapshot-Transport (P22)

Die gerenderte Oberfläche wird als framework-neutraler `RenderSnapshot` (siehe
[ADR 0002](../../adr/0002-web-component-rendering-and-theming.md)) an den Browser
ausgeliefert. Ein schlanker Vanilla-JS-Client
(`resources/lib/webapp-client.js`) hält den aktuellen Snapshot, rendert ihn und
schickt bei einem UI-Event den Snapshot-Zyklus erneut an — ohne vollständigen
Seiten-Reload.

### Endpunkte

```
GET  /webapp/:appId/snapshot?location=<route>&dialog=<dialogId?>
       → { snapshot: RenderSnapshot }     (derselbe Baum, den die HTML-Route serialisiert)

POST /webapp/:appId/event   (Content-Type: application/json)
       → { message, location, dialog, snapshot }
```

### Event-Payload (Browser → Runtime)

Der Client schickt genau die Felder, die die `msg.ui`-Event-Message speisen:

```
{
  actionId : <id der ausgelösten Aktion>          ← Pflicht
  sourceId : <componentId der auslösenden Komponente>  → msg.ui.componentId
  event    : "click" | "submit" | "select" | "change"  → msg.ui.event
  location : <aktuelle Route>                      → msg.ui.route
  params   : { ... }                               ← z.B. Formularwerte, rowId
}
```

### Antwort (Runtime → Browser)

```
{
  message  : <die emittierte msg.ui-Event-Message, Format siehe oben>
  location : <resultierende Route nach Navigation>
  dialog   : <id eines offenen Dialogs | undefined>
  snapshot : <neuer RenderSnapshot zum Rendern>
}
```

Der Client führt beim Re-Render einen **keyed Morph** durch: nur geänderte
Knoten werden ersetzt, sodass Fokus und Scroll-Position bei Listen-/State-Updates
erhalten bleiben.
