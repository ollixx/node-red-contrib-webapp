# `ui-action`

## Zusammenfassung

Sendet eine UI-Aktion vom Node-RED Flow an den Client. `ui-action` ist der einzige Knoten, der den Interaktionszustand der UI verändert (Sichtbarkeit, Aktivierungszustand, Navigation, Fokus). Fachliche Daten gehören in `ui-store`.

## Abhängigkeiten

**Parent-Knoten:**
- `ui-app`: Pflicht. Die App bestimmt den Routing-Kontext und an welchen Client Actions weitergeleitet werden.

## Editor

**Pflichtfelder:**
- `parent`: Auswahl einer `ui-app`. Wird als SelectBox angezeigt.

**Optionale Felder:**
- `name`: Node-RED-Anzeigefeld.
  - Default: `"Action N"` (fortlaufende Nummer aller ui-action-Knoten, startend bei 1)
- `actionType`: `navigate | disable | enable | show | hide | trigger`
  - Gibt der Action einen vordefinierten Typ. Kann durch `msg.ui.action.type` überschrieben werden.
- `to`: Zielpfad für `actionType: navigate`
- `description`

## Zieladressierung

### Output-Port Wiring (primär — P20a)

Der Zielknoten wird im Node-RED Flow direkt mit dem Output-Port von `ui-action` verdrahtet. Das ist der bevorzugte Weg für alle statischen, bekannten Ziele.

```
ui-action (disable) ──→ ui-button "Speichern"
ui-action (show)    ──→ ui-container "Fehlermeldung"
ui-action (open)    ──→ ui-dialog "Bestätigung"
```

### `targetId` aus `msg` (dynamisch zur Laufzeit)

Wenn das Ziel erst zur Laufzeit bekannt ist, kann die Node-ID des Zielknotens in der `msg` mitgeliefert werden:

```json
{ "ui": { "action": { "type": "disable", "targetId": "<node-id>" } } }
```

`targetId` überschreibt das statische Wiring. Typischer Anwendungsfall: Das Event enthält eine `sourceId`, die als Ziel der Reaktion genutzt wird.

## Input

Empfängt eine `msg` aus dem Node-RED Flow. Relevante Felder:

```
msg.ui.action.type      = "navigate" | "disable" | "enable" | "show" | "hide" | "trigger"
msg.ui.action.targetId  = <node-id>  ← überschreibt das statische Wiring
msg.ui.clientId         = <client>   ← schränkt die Action auf einen bestimmten Client ein
```

## Output

Der Output-Port ist mit dem Zielknoten verdrahtet. Die eingehende `msg` wird an den Zielknoten weitergeleitet. Bei `targetId`-Override wird die `msg` direkt an den angegebenen Knoten gesendet, nicht über den Output-Port.

## Besonderheiten

- `targetMode` und `target` sind deprecated (vor P20a). Sie werden für bestehende Flows noch akzeptiert, aber neue Flows sollten den Output-Port verwenden.
- `ui-button` hat ab P20a keinen `action`-Verweis mehr — Klick-Events werden direkt auf dem Output-Port des Buttons ausgegeben und dann ggf. an `ui-action` weitergeleitet.
