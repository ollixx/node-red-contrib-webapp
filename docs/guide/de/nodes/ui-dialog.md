# ui-dialog

Ein Dialog mit eigenem Layout — offengelegt über `open` / `close`, immer modal.

> English: [../../nodes/ui-dialog.md](../../nodes/ui-dialog.md)

## Zweck

`ui-dialog` definiert einen **Dialog mit eigenem Layout** innerhalb einer App.
Er ist ein offengelegtes Element: er wird über die Action-Verben `open` /
`close` offengelegt (nicht `show` / `hide`) und kann optional vom Nutzer
geschlossen werden. Sein Inhalt wird wie bei einer Route aus Layout-Slots
zusammengesetzt — View-Knoten mounten über `dialog:<id>/<slot>`. Der Server
hält den autoritativen Offen-Zustand und pusht ihn an die Clients.

## Wann einsetzen

- Eine Bestätigung, ein Formular oder Details in einem Overlay über der Seite.
- Aus einem Button per `ui-action` mit Verb `open` offenlegen; schließen über
  `close` oder (wenn schließbar) das native X / ESC / Overlay-Klick.
- Einen Dialog mit **Parent Route** auf eine Route skopieren, sodass er nur dort
  erscheint.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Dialog N` |
| **App** | Die Parent-`ui-app` aus dem App-Picker. Pflicht. | App-Referenz | — |
| **Titel** (`title`) | Sichtbarer Dialog-Titel (Header). Entfällt bei `closable: false` (kein Header). | Freitext | leer |
| **Parent Layout** (`layout`) | Layout-Preset des Dialogs. Das `dialog`-Preset bildet seine Slots auf die nativen Dialog-Slots ab (`header` / `header-actions` / `content` / `footer`). | `vertical` / … / `dialog` | `vertical` |
| **Parent Route** (`route`) | Optionale Kopplung an eine `ui-route` derselben App: der Dialog ist dann nur bei aktiver passender Route darstellbar. Leer = in jeder Route darstellbar. | Routen-Referenz | leer |
| **Modal** (`modal`) | **Dialoge sind heute immer modal.** Das aktive Backend (`sl-dialog`) ist nativ modal, daher verhält sich `modal:false` identisch zu `modal:true`. Das Feld ist ein Platzhalter für einen künftigen nicht-modalen Modus — die Doku verspricht noch kein Nicht-Modal. | Checkbox | `true` |
| **Schließbar** (`closable`) | Der native Schließen-Button / das Nutzer-Dismissal. `true` zeigt das X und erlaubt X / ESC / Overlay-Klick; `false` entfernt den gesamten Header und der Dialog wird **nur** über `open` / `close` gesteuert. | Checkbox | `true` |
| **Gruppen** (`requiresGroup`) | Kommaseparierter Authz-Guard. Leer = nur Auth; gesetzt = der User braucht eine der Gruppen (server-seitig erzwungen: der Dialog fehlt sonst vollständig im Snapshot). | Gruppennamen | leer |
| **Events** | Welche Lebenszyklus-Events feuern — jedes aktive Event erzeugt einen Output-Port. | `onOpen` / `onClose` | keine |

## Eingang

`ui-dialog` wird über die Action-Verben **`open` / `close`** offengelegt — sende
eine `msg.ui.action` mit `type: "open"` / `"close"`, deren Target (oder das
Wiring) den Dialog adressiert. `openDialog` / `closeDialog` gelten als Aliase.
Unbekannte / fachfremde Messages — inkl. Verben, die der Dialog nicht besitzt —
werden unverändert durchgereicht.

## Ausgänge / Events

Ein Output-Port je aktivem Event:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `onOpen` | der Dialog wird geöffnet | `event`, `dialogId`, `clientId` |
| `onClose` | der Dialog wird geschlossen (auch via natives X / ESC / Overlay) | `event`, `dialogId`, `clientId` |

Schließt der Nutzer den Dialog, setzt der Server autoritativ
`ui.dialogs.<id>.open = false`, pusht einen frischen Snapshot und emittiert
`onClose`.

## Beispiele

### 1. Ein Button, der einen modalen Dialog öffnet

Die Startseite zeigt einen Button; ein Klick feuert eine `open`-Action, die an
einen Dialog verdrahtet ist, dessen Content-Slot eine Bestätigungs-Zeile zeigt.

Flow-Datei: [`examples/guide/ui-dialog.json`](../../../../examples/guide/ui-dialog.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-dialog.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideDialog/` öffnen und **Open dialog**
   klicken — ein modaler Dialog erscheint; mit dem X schließen.

## Verwandt

- [`ui-app`](ui-app.md) — Parent und Routing-Kontext
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — Dialog öffnen/schließen, Route-Scoping
- [`ui-action`](ui-action.md) — die Verben `open` / `close`
- Contract-Doc (intern, Deutsch): `docs/nodes/structure/ui-dialog.md`
