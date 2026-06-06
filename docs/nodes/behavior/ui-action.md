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
- `actionType`: das kanonische Interaktions-Verb (SelectBox). Kann durch
  `msg.ui.action.type` überschrieben werden.
- `to`: Zielpfad für `actionType: navigate`.
- `target`: Node-ID des Zielknotens (alternativ zum Output-Port-Wiring; wird durch
  `msg.ui.action.targetId` zur Laufzeit überschrieben).
- `part`: Sub-ID innerhalb des Ziels für `open` / `close` / `select`
  (z.B. Accordion-Sektion, Tree-Branch, Tab-Name). Überschreibbar via
  `msg.ui.action.part`.
- `description`

### Kanonisches Verb-Set (ADR 0005)

Die Verben sind in drei semantische Klassen getrennt:

- **Sichtbarkeit (Präsenz):** `show` / `hide` — blendet ein beliebiges Element
  ein/aus (CSS `display`). Ein Button kann ein Element `show`/`hide`.
- **Offenlegung (Disclosure):** `open` / `close` — öffnet/schließt ein bereits
  sichtbares, aufklappbares Element (Dialog, Drawer, Accordion-Sektion,
  Collapse/Details, Tree-Branch). Ersetzt das frühere `openDialog`/`closeDialog`;
  diese werden als Aliase weiterhin akzeptiert. `open`/`close` nutzen optional
  `part` für die Granularität (welche Sektion/Branch).
- **Einzelauswahl:** `select` — genau eines aus einer Geschwister-Gruppe aktiv
  (Tab, Stepper-Schritt, Menü). Nutzt `part`.

plus `navigate`, `enable` / `disable`, `focus`, `reset`.

`submit` und `remove` wurden in P29 entfernt (Daten-Actions verstoßen gegen
"Actions ändern nur Interaktionszustand"). Es gibt **keine** CRUD-Verben.

Der Aktions-Effekt reist über den SSE-`command`-Kanal an den Browser, **nicht** in
der Wire-`msg`. Sichtbarkeit / enabled / open-Zustand werden client-seitig in einer
Interaktions-Overlay gehalten (ADR 0005), die nach jedem Snapshot-Re-Render erneut
angewandt wird — ein `show`/`hide` überlebt also einen ui-store-getriebenen
Snapshot-Push.

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
msg.ui.action.type      = "navigate" | "show" | "hide" | "open" | "close" | "select" | "enable" | "disable" | "focus" | "reset"
msg.ui.action.targetId  = <node-id>  ← überschreibt das statische Wiring / das `target`-Feld
msg.ui.action.part      = <sub-id>    ← Granularität für open / close / select (Accordion-Sektion, Tree-Branch, Tab)
msg.ui.clientId         = <client>    ← schränkt die Action auf einen bestimmten Client ein
```

## Output

Der Output-Port reicht die **eingehende `msg` unverändert** weiter (Wire-Chaining,
events.md) — der Aktions-Effekt wird NICHT in die Wire-`msg` injiziert, sondern
reist separat über den SSE-`command`-Kanal an den Client. So kann der Flow hinter
dem `ui-action`-Knoten mit dem ursprünglichen Event weiterarbeiten.

## Besonderheiten

- `ui-button` hat ab P20a keinen `action`-Verweis mehr — Klick-Events werden direkt auf dem Output-Port des Buttons ausgegeben und dann ggf. an `ui-action` weitergeleitet.
- `openDialog` / `closeDialog` werden als Aliase von `open` / `close` (ohne `part`) weiterhin akzeptiert (Abwärtskompatibilität, ADR 0005).
