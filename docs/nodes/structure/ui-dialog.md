# `ui-dialog`

## Zusammenfassung

Definiert einen Dialog mit eigenem Layout.

Aktuelles MVP-Verhalten:
- Dialoge werden über einen State in einem Store geöffnet und geschlossen.
  - Frage: macht es Sinn, ein flag nach Schema `<store-name>:<flag-name>` hier zu definieren?
- View-Knoten können über `dialog:<dialogId>/...` in Dialog-Slots mounten.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`: Pflicht. Dialoge gehören zu einer App und werden in deren Routing-Kontext geöffnet und geschlossen.

**Gemeinsam genutzte Services und Komponenten:**
- Referenziert ein Layout-Preset über `layoutId`
- Optionale Verknüpfung mit `ui-route` über `routeId`
- Öffnen/Schließen läuft über `ui-store` State

## Editor

**Pflichtfelder:**
- `parent`: Auswahl einer `ui-app`. Wird als SelectBox angezeigt; bei mehr als 20 Einträgen als filterbarer Dialog.
- `layout`: Layout-Preset
  - Default: `vertical`
  - Presets: `vertical`, `horizontal`, `app`, `grid`, `absolute`, `dialog`
  - Das `dialog`-Preset (P64) ist auf den nativen `<sl-dialog>` zugeschnitten.
    Seine Slots werden direkt auf die nativen Shoelace-Slots abgebildet:
    `header` → `label`, `header-actions` → `header-actions`, `content` → Default
    (Body), `footer` → `footer`.

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Dialog N"` (fortlaufende Nummer aller ui-dialog-Knoten, startend bei 1)
- `title`: sichtbarer Titel des Dialogs
- `routeId`: optionale Route-Verknüpfung
- `modal`: Legt fest, ob der rest der webapp geblockt wird (light box) oder nicht.
- `closable`: Default `true`. Steuert den nativen Schließen-Button (X) des
  `<sl-dialog>`. Bei `true` zeigt der Dialog das native X und ist per X / ESC /
  Overlay-Klick schließbar. Bei `false` rendert der Dialog `no-header` — der
  gesamte Header (natives X **und** Titel) entfällt; der Dialog wird dann
  ausschließlich über Store-State / Message gesteuert.

## Input

Ein Dialog kann auf zwei Wegen geöffnet und geschlossen werden — beide können parallel genutzt werden:

1. **Store-State**: Ein `ui-store`-Wert kontrolliert die Sichtbarkeit. Der Dialog beobachtet einen konfigurierten Store-Pfad und öffnet/schließt sich reaktiv.
2. **Direkte Message**: Format siehe [messages.md](../concepts/messages.md) — `msg.ui.dialog.op: "open" | "close" | "toggle"`.

## Output

Konfigurierbare Events — im Editor per Checkbox aktivierbar. Pro aktivem Event ein Out-Port
(positionelles Routing: Out-Port-Index = `events.indexOf(event)`):

| Event | Beschreibung | `msg.ui`-Felder |
|---|---|---|
| `onOpen` | Dialog wurde geöffnet | `event: "onOpen"`, `clientId` |
| `onClose` | Dialog wurde geschlossen (auch via natives X / ESC / Overlay) | `event: "onClose"`, `clientId` |

Wird der native Dialog über X / ESC / Overlay geschlossen, emittiert der Knoten
`onClose` an seinem Out-Port UND der Server setzt autoritativ
`ui.dialogs.{id}.open = false` und pusht einen frischen Snapshot — ein impliziter
Close ohne verdrahtete Close-Action.

## Besonderheiten

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](../concepts/layout.md).

- Dialoge rendern als nativer Shoelace `<sl-dialog>` (P64): das native X, ESC- und
  Overlay-Dismissal sowie Focus-Trap/a11y kommen direkt von Shoelace — kein
  selbstgebautes Chrome, kein hartkodierter Close-Link mehr.
- `closable` steuert das native Header/X (siehe Editor-Feld); `closable: false`
  ⇒ natives `no-header` (entfernt Header inkl. Titel).
