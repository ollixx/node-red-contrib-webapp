# Events — Client → Server

## Grundprinzip

Events fließen **ausschließlich vom Client zum Server** (Node-RED). Sie beschreiben, was der Nutzer getan hat. Sie beschreiben nie, was als Reaktion passieren soll — das ist Aufgabe des Node-RED Flows und ggf. einer [Action](./actions.md).

Diese Richtung ist absolut:
- Client → Server: Event ✓
- Server → Client: **kein Event**, sondern eine [Action](./actions.md) oder Daten via [Store/Query](../state/ui-store.md)

Events transportieren keinen Zustand und haben keine Seiteneffekte. Sie sind reine Benachrichtigungen.

---

## Wer erzeugt Events?

Jeder UI-Knoten, der Nutzerinteraktion ermöglicht, hat einen **Output-Port**. Sobald der Nutzer interagiert, emittiert der Knoten ein `msg`-Objekt auf diesem Port. Der App-Autor verdrahtet diesen Port im Node-RED Flow mit dem nächsten Verarbeitungsschritt.

Knoten mit Output-Port (Auswahl):

| Knoten | Event-Auslöser |
|---|---|
| `ui-button` | Klick auf den Button |
| `ui-table` | Zeilenauswahl, Zeilenaktion, Checkbox-Änderung |
| `ui-input` | Feldänderung, Submit |
| `ui-select` | Auswahlwechsel |
| `ui-checkbox` | Zustandswechsel |
| `ui-radio` | Auswahlwechsel |
| `ui-slider` | Werteänderung |
| `ui-route` | Routenwechsel (onEnter, onLeave) |
| `ui-dialog` | Dialog geöffnet/geschlossen |

---

## Message-Format

Alle Events tragen ein `msg.ui`-Objekt. Das Mindestformat:

```json
{
  "ui": {
    "appId":    "<id der ui-app>",
    "clientId": "<id des auslösenden Clients>",
    "event":    "<event-typ>",
    "sourceId": "<node-id des auslösenden Knotens>"
  }
}
```

Zusätzliche Felder je nach Event-Typ:

```json
{
  "ui": {
    "appId":    "myApp",
    "clientId": "client-abc123",
    "event":    "rowSelect",
    "sourceId": "node-id-des-table-knotens",
    "params": {
      "rowId": "42",
      "row":   { "id": 42, "name": "Müller GmbH" }
    }
  }
}
```

### Bekannte Event-Typen

| `event` | Quelle | `params` |
|---|---|---|
| `click` | `ui-button` | — |
| `rowSelect` | `ui-table` | `rowId`, `row` |
| `rowAction` | `ui-table` | `rowId`, `row`, `actionLabel` |
| `checkboxChange` | `ui-table`, `ui-checkbox` | `checked`, `rowId` (Tabelle) |
| `change` | `ui-input`, `ui-select`, `ui-slider`, `ui-radio`, `ui-switch` | `value` (bei `ui-switch`/`ui-checkbox`: `checked`) |
| `submit` | `ui-input` (Enter/Submit) | `value` |
| `onEnter` | `ui-route`, `ui-app` (Root) | `route`*, `params` |
| `onLeave` | `ui-route`, `ui-app` (Root) | `route`*, `params` |
| `onOpen` | `ui-dialog` | `dialogId` |
| `onClose` | `ui-dialog` | `dialogId` |
| `onShow` | `ui-container` | — |
| `onHide` | `ui-container` | — |

> \* Bei `onEnter`/`onLeave` liegt die Route **nicht** unter `params`, sondern als
> eigenes Feld `msg.ui.route` (Geschwister von `msg.ui.params`). Beide Lifecycle-Events
> tragen `params` (die Routen-Parameter); es gibt kein Feld `path`.
>
> Knoten mit mehreren aktiven Events haben **mehrere Output-Ports**; der Port-Index
> entspricht der Position des Events in der konfigurierten Events-Liste.

---

## Verarbeitung im Flow

Der App-Autor entscheidet im Node-RED Flow, was mit einem Event passiert. Typische Reaktionen:

```
ui-button (output) ──→ function node ──→ HTTP Request (API-Call)
                                    └──→ ui-action (navigate zu Ergebnisseite)
                                    └──→ ui-store  (Zustand aktualisieren)
```

Es gibt **keine automatische Verknüpfung** zwischen einem Event und einer Aktion. Alles wird explizit im Flow verdrahtet. Das ist bewusst so — der Flow ist der einzige Ort für Logik.

---

## Abgrenzung

| Konzept | Richtung | Zweck |
|---|---|---|
| **Event** | Client → Server | Was der Nutzer getan hat |
| **Action** | Server → Client | Was die UI tun soll |
| **Store/Binding** | bidirektional | Datenhaltung und -anzeige |

Events sind keine Actions. Ein Click-Event führt nicht automatisch zu einer Navigation — erst der Flow entscheidet, ob und welche Action ausgelöst wird.

Siehe auch: [actions.md](./actions.md), [messages.md](./messages.md)
