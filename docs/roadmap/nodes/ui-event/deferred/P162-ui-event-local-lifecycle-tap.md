---
id: P162
node: ui-event
epic: nodes/ui-event
title: "Konzept: ui-event — referenzbasierter lokaler Tap der App/Route-Lifecycle-Events (onEnter/onLeave) neben dem Consumer"
status: deferred
deferred_reason: "Neuer Knoten + Vertrag; ADR-würdig (Scope-Auswahl, Event-Typen, Output-Form: Ein-Port-mit-Typ vs. Port-je-Typ). Owner-Idee steht, Restfragen offen. Hängt logisch an ADR 0016 (löst die Lange-Leitung-Ergonomie des onEnter-Wire-Triggers)."
dependencies: []
---
# P162 — Konzept: ui-event (geparkt)

> Die **Referenz-Antwort** auf die Lange-Leitung-Ergonomie aus
> [ADR 0016](../../../../adr/0016-ui-query-trigger-model-visible-no-auto-fire.md):
> der `onEnter`-Wire macht den Query-Trigger **sichtbar**, kostet aber ggf. eine
> Leitung quer über den Canvas. `ui-event` ist der **lokale Tap** derselben
> Events — sichtbar **und** kurze Leitung.

## findings (Owner-Wortlaut, 2026-06-11)

- "Meine Idee danach: ein ui-event Knoten? Der hätt nur einen Ausgang, oder einen
  Ausgang je event typ und ist einfach ein 'repeater' von den events, die auch
  aus ui-app kommen. Vorteil: man spart 'lange leitungen', packt ui-event direkt
  neben die query und sieht dann auch, was passiert."

## Worum es geht

`ui-event` ist ein **referenzbasierter lokaler Tap** des App/Route-Lifecycles —
das Pendant zu Node-REDs `link in` / `status` / `catch`: kein neuer Event, sondern
ein **Repeater** derselben Events, die schon aus `ui-app`/`ui-route` fließen
(`onEnter`/`onLeave`, P112). Man droppt ihn **neben** den Consumer (z. B. eine
`ui-query`), er „abonniert" die Lifecycle-Events der referenzierten App/Route und
gibt sie **lokal** mit kurzer Leitung aus.

Damit ist er die **Referenz-Seite** der Wire-vs-Referenz-Dualität
([ADR 0011](../../../../adr/0011-ui-action-navigation-target-modes-and-dual-path-coding.md))
**für Lifecycle-Events**: Wire = `route onEnter → query` quer über den Canvas;
Referenz = `ui-event` neben der Query. Beide sind **sichtbar** — anders als der in
ADR 0016 verworfene versteckte Auto-Fire.

## Zu klären (ADR-würdig)

- **Scope-Auswahl:** Welche App / welche Route taps der Knoten? (Mount-/Referenz-
  Picker analog ADR 0014; Default = die Route, in der er gemountet/parent ist?
  Oder explizite Referenz wie das Store-Binding?)
- **Event-Typen:** `onEnter`/`onLeave` sicher; weitere Lifecycle-Events
  (Deploy/Update P106, Param-Change)? Whitelist definieren.
- **Output-Form (Kern-Entscheidung):**
  - **Ein Ausgang**, Event-Typ im `msg` (z. B. `msg.ui.event = "enter"`) — schlank,
    ein Knoten je Scope; Filtern macht der Consumer.
  - **Port je Event-Typ** (wie die P12-Event-Ports) — selbst-dokumentierend im
    Flow, aber fixe Port-Anzahl/Reihenfolge.
  - Empfehlung steht noch aus; tendenziell **ein Port mit Typ im msg** (flexibler,
    spätere Event-Typen brechen keine Verdrahtung).
- **Per-Client:** Der getappte Event trägt die `clientId` (P15) — `ui-event`
  muss sie unverändert durchreichen (sonst bricht der per-client-Trigger aus
  ADR 0016 §5).
- **Sichtbarkeit/Status:** Status-Punkt am Knoten (letzter Event/Zeit), damit
  „man sieht, was passiert" (Owner-Wortlaut) auch ohne Debug-Knoten gilt.

## Abgrenzung

- **Kein** neuer/autonomer Trigger — nur ein **Repeater** existierender, schon
  sichtbarer Lifecycle-Events. Die Sichtbarkeits-Prämisse aus ADR 0016 bleibt
  gewahrt.
- Ersetzt **nicht** den `onEnter`-Wire — er ist die ergonomische Alternative für
  „Consumer weit weg von ui-route".

## Bei Aktivierung

Owner-Entscheidung zu Scope/Events/Output-Form + ADR; dann Schema- (Event-Contract),
Runtime- (Tap-Verdrahtung an den Lifecycle-Bus) und Editor-Pakete (Scope-Picker).
