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
  - Presets: `vertical`, `horizontal`, `app`, `grid`, `absolute`

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld. Wird bei der Darstellung des Knotens und in Auswahlfeldern angezeigt.
  - Default: `"Dialog N"` (fortlaufende Nummer aller ui-dialog-Knoten, startend bei 1)
- `title`: sichtbarer Titel des Dialogs
- `routeId`: optionale Route-Verknüpfung
- `modal`: Legt fest, ob der rest der webapp geblockt wird (light box) oder nicht.

## Input

Ein Dialog kann auf zwei Wegen geöffnet und geschlossen werden — beide können parallel genutzt werden:

1. **Store-State**: Ein `ui-store`-Wert kontrolliert die Sichtbarkeit. Der Dialog beobachtet einen konfigurierten Store-Pfad und öffnet/schließt sich reaktiv.
2. **Direkte Message**: Format siehe [messages.md](messages.md) — `msg.ui.dialog.op: "open" | "close" | "toggle"`.

## Output

Konfigurierbare Events — im Editor per Checkbox aktivierbar. Pro aktivem Event ein Out-Port:

| Event | Beschreibung | `msg.ui`-Felder |
|---|---|---|
| `onOpen` | Dialog wurde geöffnet | `event: "onOpen"`, `clientId` |
| `onClose` | Dialog wurde geschlossen | `event: "onClose"`, `clientId` |

## Besonderheiten

Siehe für das mehrfach genutzte Layout-Konzept auch [layout.md](layout.md).

- Dialoge verwenden heute eines der vorhandenen Layout-Presets.
- Das Öffnen und Schließen ist heute nicht generisch modelliert, sondern im Preview-Pfad teilhart codiert.
- Es fehlt ein klares Dialogmodell für Fokus, Backdrop, Escape-Verhalten und Rückgabewerte.
