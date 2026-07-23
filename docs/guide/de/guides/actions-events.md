# Actions & Events

Wie Nutzerinteraktionen deinen Flow erreichen, wie dein Flow die UI steuert
— und **die zwei Wege**, beides zu verbinden: Wire vs. Referenz.

> English (canonical): [../../guides/actions-events.md](../../guides/actions-events.md)

## Ziel

Das Click-Event eines Buttons mit UI-Verhalten verdrahten (eine Karte
aus-/einblenden), die Richtungs-Regel verstehen (Events hoch, Actions
runter) und wissen, wann ein Wire und wann eine Referenz der richtige Weg
ist.

## Voraussetzungen

- [Erste Schritte](../getting-started.md) und
  [Bindings & State](bindings-state.md).

## Die Richtungs-Regel

- **Events fließen Client → Server.** Sie beschreiben, *was der Nutzer
  getan hat* — nie, was als Reaktion passieren soll. Jeder interaktive
  Knoten hat einen Output-Port und emittiert dort eine
  `msg.ui`-Event-Message (click, change, submit, rowSelect,
  Route-onEnter/onLeave, Dialog-onOpen/onClose, …).
- **Actions fließen Server → Client.** Sie beschreiben, *was die UI tun
  soll* — navigieren, `open`/`close` (Dialog, Accordion-Sektion, …),
  `show`/`hide`, `enable`/`disable`, `focus`, `reset`. Actions ändern nur
  Interaktionszustand, **nie Daten** (Daten laufen über Stores/Queries).

Es gibt **keine automatische Verknüpfung** zwischen Event und Reaktion.
Der Flow dazwischen gehört dir: ein Klick kann eine API aufrufen, einen
Store schreiben und eine Action auslösen — alles explizit verdrahtet. So
bleibt die gesamte Logik im Flow sichtbar.

Eine Event-Message sieht so aus (hänge einen `debug`-Knoten auf „komplette
msg" hinter eine Komponente, um sie zu inspizieren):

```json
{
  "ui": {
    "appId": "actionsApp",
    "clientId": "client-abc123",
    "event": "click",
    "sourceId": "gaeHideButton"
  }
}
```

`clientId` identifiziert den Browser-Tab, der das Event ausgelöst hat —
reiche `msg.ui.clientId` weiter, wenn eine Reaktion nur diesen Client
treffen soll.

## Die zwei Wege: Wire vs. Referenz

Alles, was *einen anderen Knoten adressiert* — eine `ui-action`, die ihre
Ziel-Komponente anspricht, eine `ui-store-action`, die einen Store
mutiert, eine `ui-query-action`, die eine Query refresht — bietet dieselbe
Wahl:

### 1. Wire (primär, empfohlen)

Das Ziel hängt am **Output-Port** des Knotens. Bei `ui-action`: den Output
mit der Ziel-Komponente verdrahten (`ui-action (hide) → ui-container`) —
das Wire *ist* die Adresse; der verdrahtete Zielknoten führt das Kommando
aus und pusht es an den Browser. Bei `ui-store-action`/`ui-query-action`
im **wire**-Modus: der Knoten emittiert das fertige Kommando-Envelope
(`msg.ui.store` / `msg.ui.query`) am Output, und du verdrahtest es weiter
an den Store/die Query, die es anwendet.

*Warum primär:* der Flow bleibt visuell explizit — das Verhalten lässt
sich vom Canvas ablesen, es gibt keine versteckten String-Referenzen, und
es ist der Node-RED-idiomatische Weg.

### 2. Referenz (sekundär, „wireless")

Das Ziel wird per **Picker** gewählt und in der Konfiguration
gespeichert:

- `ui-action` kann ein oder mehrere Zielknoten direkt auf dem Canvas
  auswählen („Auf Canvas wählen") statt sie zu verdrahten; bei Eingang
  wird die Action an jedes gewählte Ziel zugestellt, genau wie über ein
  Wire.
- `ui-store-action` / `ui-query-action` im **reference**-Modus wenden die
  Operation **direkt server-seitig** auf den referenzierten Store / die
  Query an — ganz ohne Wire dorthin. Gebundene Views aktualisieren sich
  trotzdem live.

*Wann bevorzugen:* wenn Wires den Canvas zumüllen würden (viele Ziele,
kreuzende Flows) oder die Action weit weg von ihrem Ziel sitzt. Das
Verhalten ist identisch — aber die Verbindung ist auf dem Canvas nicht
mehr sichtbar; setze sie bewusst ein.

Eine dritte, dynamische Variante gibt es für Laufzeit-Ziele: eine Message
kann `msg.ui.action.target = "<node-id>"` tragen und so das Ziel
überschreiben — nützlich, wenn das Ziel aus Event-Daten stammt.

## Schritte

1. Erstelle eine App mit einer `ui-container`-Karte (einem `ui-text`
   darin) und zwei Buttons „Hide card" und „Show card" im App-Content.
2. Füge zwei `ui-action`-Knoten mit den Action-Typen `hide` und `show`
   hinzu. Verdrahte: Output jedes Buttons → Input seiner Action, und
   Output jeder Action → den **Container**-Knoten. Deploy: die Buttons
   blenden die Karte aus und ein — das Wire zum Container ist die
   Ziel-Adresse (Weg 1).
3. Füge einen `ui-store` (`clicks`, initial `{"last":"(no click yet)"}`)
   und einen daran gebundenen `ui-text` (Sub-Pfad `last`) hinzu.
4. Füge eine `ui-store-action` im **reference**-Modus hinzu (Store per
   Referenz gewählt, Op `set`, Pfad `last`), hinter einem kleinen
   `function`-Knoten, der eine Beschreibung des Klicks in `msg.payload`
   legt. Verdrahte beide Buttons hinein. Deploy: jeder Klick aktualisiert
   auch den „last click"-Text — **ohne Wire zum Store** (Weg 2).
5. Beobachte die Richtungs-Regel in Aktion: Button → Event → Flow →
   Action/Store — und die UI aktualisiert sich über den Live-Stream.

## Beispiel-Flow

Das fertige Ergebnis der Schritte:
[`examples/guide/actions-events.json`](../../../../examples/guide/actions-events.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/actions-events.json` auswählen (oder ihr
   JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/actionsApp/` öffnen — Karte
   aus-/einblenden und den Last-Click-Text beobachten.

## Wie weiter

- [Navigation & Dialoge](navigation-dialogs.md) — die `navigate`-Action
  und ihre drei Modi, Dialoge mit `open`/`close`.
- [Daten anzeigen](displaying-data.md) — der event-getriebene
  Query-Refresh-Loop.
