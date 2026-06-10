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
msg.ui.action.params = { id: "42" }        ← nur navigate: benannte URL-Parameter (optional)
msg.ui.action.part   = "<sub-id>"          ← open/close/select (optional)
msg.ui.action.target = "<node-/component-id>"  ← optionaler Override
msg.ui.clientId      = <optional: nur für diesen Client>
```

Das Schema validiert **nur** `msg.ui.action`; alle übrigen `msg.*`- und
`msg.ui.*`-Felder werden unangetastet durchgereicht. Weil es ein gewöhnlicher
Message-Contract ist, kann **jeder** Knoten ihn erzeugen — `ui-action` ist nur
der bequeme, typisierte Emitter. Der App-Autor verdrahtet den Out-Port von
`ui-action` direkt mit dem In-Port des Zielknotens; der Zielknoten verarbeitet
das ihm bekannte Verb, **führt den SSE-`command`-Push an den/die Client(s) aus**
(P59 / ADR 0007 §2) und reicht die Message sonst durch.

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

## Navigation

Navigation ist **kein eigenes Message-Format** — sie reist als Action-Message
mit `type: "navigate"` (siehe oben). Die Zielquelle ist ein expliziter Modus
(ADR 0011 / P118), der die Absicht speichert:

- **Modus `wire`:** Kein `to` in der msg. Die `ui-route`/`ui-app`, welche die
  Navigation **empfängt**, baut die Location aus dem **eigenen** `path` + den
  `msg.ui.action.params`. Verzweigung ist wohldefiniert — die erreichte Route gewinnt.
- **Modus `route`:** `ui-action` löst die referenzierte Route auf, wertet die
  typisierten `params` gegen die msg aus und trägt die fertige Location als
  explizites `msg.ui.action.to`.
- **Modus `url`:** `ui-action` setzt `to` (typedInput: `str`/`msg`/`flow`/`global`/`jsonata`)
  als ganze URL; `params` entfällt.

**Adressierungs-Vorrang (ADR 0011 §3):** Trägt die msg bereits ein explizites
`to` (Modus `route`/`url` oder ein Override), reicht eine empfangende `ui-route`
sie **unverändert durch** und setzt NICHT ihren eigenen Pfad darauf. Nur
zielloses navigate (Modus `wire`) löst „Route baut die Location" aus.

`onEnter`/`onLeave` der betroffenen Route(n) werden in **allen** Modi emittiert
(siehe [events.md](events.md)). Der frühere `msg.ui.navigate`-Pfad und der Knoten
`ui-navigation` sind **deprecated**.

---

## Dialog öffnen/schließen

Dialoge werden über die **Action-Verben `open`/`close`** offengelegt — also eine
Action-Message mit `type: "open"`/`"close"`, deren `part`/`target` den Dialog
adressiert. Kein eigenes Format nötig.

> Legacy: Ein `msg.ui.dialog`-Handler (`{ id, op }`) existiert noch, validiert
> die Operation und reicht sie durch, ist aber kein aktiver Push-Mechanismus
> mehr. Bevorzugt sind die `open`/`close`-Verben.

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

Schreiben (`msg.ui.store` mit `set`/`patch`/`delete`/`replace`/`reset`) und die
Änderungs-Notification sind in [stores.md](stores.md) konzeptionell und in
[ui-store.md](../state/ui-store.md) als Knoten-Referenz beschrieben.

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
         Folgeeignisse: snapshot (Store-Update) | command (Interaktionsbefehl vom Zielknoten)

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
data: { command: { type, ... } }     ← Interaktionsbefehl, gepusht vom Zielknoten (ADR 0007 §2)
```

Der Client führt beim Re-Render einen **keyed Morph** durch: nur geänderte
Knoten werden ersetzt, sodass Fokus und Scroll-Position bei Listen-/State-Updates
erhalten bleiben.
