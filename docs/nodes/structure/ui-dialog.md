# `ui-dialog`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-dialog` definiert einen **Dialog mit eigenem Layout** innerhalb einer App.
Der Dialog ist ein aufklappbares (offenlegbares) Element: er wird über die
Action-Verben `open` / `close` offengelegt und kann optional vom Nutzer selbst
geschlossen werden. Sein Inhalt wird wie bei einer Route über Layout-Slots
zusammengesetzt — View-Knoten mounten über `dialog:<id>/<slot>` in den Dialog.

## Einordnung

- **Parent:** genau eine `ui-app`. Dialoge gehören zu einer App und werden in deren Routing-Kontext geöffnet/geschlossen.
- **Kinder:** View-Knoten mounten über `mount` in die Slots des Dialogs (`dialog:<id>/content`, beim `dialog`-Preset zusätzlich `header`/`header-actions`/`footer`).
- **Erreichbarkeit:** der Dialog ist kein eigener URL-Pfad — er wird über `open`/`close` ein- und ausgeblendet, optional an eine Route gekoppelt (`routeId`). Ist er an eine Route gekoppelt, ist er **nur bei aktiver passender Route** darstellbar (siehe `routeId` in den Feldern).
- **Rolle zur Laufzeit:** der Server hält den autoritativen Offen-Zustand (`ui.dialogs.<id>.open`) und pusht ihn per Snapshot an die Clients.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (SelectBox,
Node-Picker-Dialog, Event-Checkboxen).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Dialog N`. |
| `app` | „App" | Node-Picker-Dialog (Preset Apps) | **ja** | Die Parent-`ui-app`. Auswahl aus einer filter- und scrollbaren Liste der Apps. |
| `title` | „Titel" | Textfeld | optional | Sichtbarer Titel des Dialogs (Header). Entfällt bei `closable: false` (kein Header). |
| `routeId` | „Parent Route" | Node-Picker-Dialog (Preset Routes) | optional | Optionale Kopplung an eine `ui-route` derselben App. **Ist `routeId` gesetzt, ist der Dialog nur bei aktiver passender Route darstellbar:** der Renderer filtert die Dialoge nach der gerade aktiven Route (`dialog.routeId === aktive Route-Id`). Bei einer anderen aktiven Route wird der Dialog **auch unter `?dialog=<id>` nicht gerendert**. Ohne `routeId` ist der Dialog in jeder Route der App darstellbar. |

### Gruppe „Layout"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `layout` | „Parent Layout" | SelectBox (Layout-Preset) | **ja** | Layout des Dialogs (im Feld `layout` gespeichert; P259/ADR 0038: bare Referenz-Name, vormals `layoutId` — Alt-Flows migrieren beim Öffnen+Speichern). Auswahl aus den Standard-Presets (`vertical`, `horizontal`, `app`, `grid`, `absolute`, `dialog`). Default: `vertical`. Das `dialog`-Preset bildet seine Slots direkt auf die nativen Dialog-Slots ab (`header`/`header-actions`/`content`/`footer`) — siehe [layout.md](../concepts/layout.md). |

### Gruppe „Verhalten"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `modal` | „Modal" | Checkbox | optional | **Dialoge sind heute immer modal.** Das aktive Renderer-Backend (`sl-dialog`) ist nativ modal (eigenes Overlay/Backdrop); der HTML-Serializer emittiert keinen Modal-/Overlay-Schalter, daher erzeugt `modal:false` heute **identisches** Verhalten wie `modal:true`. Das Feld bleibt als **noch nicht umgesetzter** Platzhalter für einen künftigen nicht-modalen Modus erhalten (ein echt nicht-modaler Dialog braucht ein anderes Primitive). Default: `true`. |
| `closable` | „Schließbar" | Checkbox | optional | Steuert den nativen Schließen-Button und das Nutzer-Dismissal. Default: `true`. Bei `true` zeigt der Dialog das native Schließen-Element und ist per X / ESC / Overlay-Klick schließbar. Bei `false` entfällt der gesamte Header (Schließen-Element **und** Titel); der Dialog wird dann ausschließlich über `open`/`close`-Actions gesteuert. |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `onOpen`, `onClose`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-dialog"`-Hilfetext im Editor soll **knapp, aber
ausreichend** sein: Zweck (Dialog mit eigenem Layout, offengelegt über
`open`/`close`), ein Hinweis auf `closable` (natives Dismissal vs. nur
Action-gesteuert), den `modal`-Status (Dialoge sind **heute immer modal** — das
Feld ist ein Platzhalter für einen künftigen nicht-modalen Modus) und ein Hinweis
auf die `onOpen`/`onClose`-Events sowie ein Link auf die ausführliche Doku. Empfohlener Link (später ggf. Wiki):
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/structure/ui-dialog.md`.

## Input

`ui-dialog` wird über die Action-Verben **`open` / `close`** offengelegt — der
Dialog ist ein aufklappbares Element im Sinne von [actions.md](../concepts/actions.md).

- **Akzeptiert:** eine `msg.ui.action` mit `type: "open"` / `"close"`, deren
  `target` (bzw. das Wiring) den Dialog adressiert. `openDialog` / `closeDialog`
  werden als Aliase weiterhin akzeptiert. Format: [messages.md](../concepts/messages.md).
- **Validierung:** keine fachlichen Verben über die Action-Vokabular-Prüfung
  hinaus.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe — insbesondere Verben, die der Dialog nicht
  besitzt. Es gilt die Framework-Regel: kein stilles Schlucken, aber auch keine
  Fehlermeldung für irrelevante Eingaben.
- **Framework-Fehler** werden gemäß [logs-errors.md](../concepts/logs-errors.md)
  als strukturierter Fehler gemeldet, nicht als gewöhnliche Eingabe behandelt.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird beim Öffnen/Schließen des
Dialogs:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `onOpen` | der Dialog wird geöffnet | `event: "onOpen"`, `dialogId`, `clientId` | Dialog-Inhalt laden / Initialdaten setzen |
| `onClose` | der Dialog wird geschlossen (auch via natives X / ESC / Overlay-Klick) | `event: "onClose"`, `dialogId`, `clientId` | Aufräumen / Entwurf verwerfen |

Wird der Dialog vom Nutzer selbst geschlossen (X / ESC / Overlay), setzt der
Server **autoritativ** `ui.dialogs.<id>.open = false` und pusht einen frischen
Snapshot — ein impliziter Close ohne verdrahtete `close`-Action; gleichzeitig
wird `onClose` am Out-Port emittiert. Feld-Details: [events.md](../concepts/events.md).

**Antizipierte Wiring-Szenarien:**
- `onOpen` → `ui-query`/`function`, das die anzuzeigenden Daten in einen
  `ui-store` lädt; gezielt per `msg.ui.clientId` für den öffnenden Client.
- `onClose` → Aufräumen (Formular-Entwurf zurücksetzen, Auswahl verwerfen).

## Theming

`ui-dialog` rendert die sichtbare Dialog-Chrome (Overlay, Header/Schließen-Element,
Footer, Focus-Trap/a11y). Diese Chrome kommt vom aktiven Renderer-Backend
(heute der native Dialog von Shoelace; weitere Backends wie Material o. ä. sind
vorgesehen und bilden dieselben Slots auf ihr jeweiliges Dialog-Primitive ab) —
kein selbstgebautes Chrome, kein hartkodierter Close-Link. Das `dialog`-Preset
mappt die Layout-Slots auf die nativen Slots des Backends. Das App-weite Theme
wird von der Parent-App geerbt. Siehe [theming.md](../concepts/theming.md).

## Besonderheiten

- **Offenlegung statt Sichtbarkeit.** Ein Dialog wird mit `open`/`close`
  offengelegt — nicht mit `show`/`hide` (Präsenz). `closable` steuert nur das
  native Nutzer-Dismissal, nicht den Action-Pfad.
- **Autoritativer Offen-Zustand.** Der Server hält `ui.dialogs.<id>.open`; ein
  Nutzer-Close wird serverseitig verbucht und per Snapshot an alle betroffenen
  Clients gespiegelt.
- **Keine Base-Fields** (`visible` / `disabled` / `color`). Ein Dialog folgt dem
  **Offenlegungs-** statt dem Sichtbarkeits-Modell: er wird über `open`/`close`
  gesteuert, nicht über `show`/`hide` oder ein `disabled`-Flag, und trägt daher
  bewusst keine der ADR-0015-Base-Fields. Präsenz/Interaktivität des Inhalts
  regeln die gemounteten View-Knoten.

## Referenzen

- [`ui-app`](ui-app.md) — Parent und Routing-Kontext
- [layout.md](../concepts/layout.md) — Presets und Slots (inkl. `dialog`)
- [actions.md](../concepts/actions.md) — `open`/`close`-Verben
- [messages.md](../concepts/messages.md) — Dialog öffnen/schließen
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Backend-neutrale Chrome

## Offene Punkte

- Ob eine deklarative Kopplung des Offen-Zustands an ein Store-Flag
  (Schema `<store>:<flag>`) sinnvoll ist, ist noch nicht entschieden.
- Ein echt **nicht-modaler** Dialog (`modal:false` mit sichtbarer Wirkung) ist ein
  künftiges Feature — es braucht ein anderes Primitive als das nativ-modale
  `sl-dialog`. Heute ist das `modal`-Feld ein Platzhalter ohne Wirkung.

Das Route-Scoping über `routeId` (Dialog nur bei aktiver passender Route
darstellbar) ist implementiert und dokumentiert (siehe Feld `routeId`) — kein
offener Punkt mehr.
