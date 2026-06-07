# `ui-action`

## Zusammenfassung

Typisierter Emitter für UI-Aktionen (Interaktionszustand: Sichtbarkeit,
Aktivierungszustand, Navigation, Fokus). Bei Eingang baut `ui-action` eine
schema-valide `msg.ui.action` aus seiner Konfiguration und sendet sie am
Output-Port. Den SSE-Push an den Client führt der **verdrahtete Zielknoten** aus
(P59 / [ADR 0007](../../adr/0007-action-message-and-per-node-interaction-handlers.md)) —
`ui-action` ist kein privilegierter Knoten mehr: Jeder Knoten, der den
`msg.ui.action`-Contract sendet (`inject`, `function`, …), löst die Interaktion
aus. Fachliche Daten gehören in `ui-store`.

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
- `to`: Navigationsziel für `actionType: navigate`, als **typedInput**
  (`str` | `msg` | `flow` | `global` | `jsonata`; P66 / ADR 0007 Amendment).
  `str` ist ein literaler Pfad (ggf. mit `:platzhaltern`); `msg`/`flow`/`global`
  lesen den Pfad zur Laufzeit aus Kontext, `jsonata` berechnet ihn aus der
  Nachricht. **Leer lassen, wenn der Knoten mit einer `ui-route` verdrahtet ist**
  (Szenario 1) — die Route liefert den Pfad aus ihrem eigenen `path`.
- `params`: benannte URL-Parameter (Key/Value). Füllen die `:platzhalter` der
  Ziel-Route. Hauptsächlich für Szenario 1 (verdrahtet mit einer `ui-route`),
  aber auch zusätzlich zu einem `to`-Template nutzbar (P66).
- `target`: **optionaler** Override. Das Ziel wird primär über das **Wiring des
  Output-Ports** bestimmt — leer lassen, wenn verdrahtet wird. Gesetzt +
  unverdrahteter Output ⇒ Backward-Compat-Pfad: die Aktion wird via
  `targetNode.receive()` direkt in den Input des Zielknotens injiziert (P59 /
  ADR 0007). Zur Laufzeit überschreibbar via `msg.ui.action.target` /
  `msg.ui.action.targetId`.
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

Der Aktions-Effekt reist über den SSE-`command`-Kanal an den Browser — gepusht vom
**Zielknoten**, nicht von `ui-action`. Sichtbarkeit / enabled / open-Zustand werden
client-seitig in einer Interaktions-Overlay gehalten (ADR 0005), die nach jedem
Snapshot-Re-Render erneut angewandt wird — ein `show`/`hide` überlebt also einen
ui-store-getriebenen Snapshot-Push.

## Zieladressierung

### Output-Port Wiring (primär — P20a)

Der Zielknoten wird im Node-RED Flow direkt mit dem Output-Port von `ui-action` verdrahtet. Das ist der bevorzugte Weg für alle statischen, bekannten Ziele.

```
ui-action (disable) ──→ ui-button "Speichern"
ui-action (show)    ──→ ui-container "Fehlermeldung"
ui-action (open)    ──→ ui-dialog "Bestätigung"
```

### `target` aus `msg` (dynamisch zur Laufzeit)

Wenn das Ziel erst zur Laufzeit bekannt ist, kann die Node-ID des Zielknotens in
der `msg` mitgeliefert werden (`targetId` bleibt als Alias akzeptiert):

```json
{ "ui": { "action": { "type": "disable", "target": "<node-id>" } } }
```

`target` überschreibt die Default-Auflösung des Zielknotens (der sonst seine
eigene Node-ID setzt). Typischer Anwendungsfall: Das Event enthält eine
`sourceId`, die als Ziel der Reaktion genutzt wird.

## Input

Empfängt eine `msg` aus dem Node-RED Flow. Relevante Felder:

```
msg.ui.action.type      = "navigate" | "show" | "hide" | "open" | "close" | "select" | "enable" | "disable" | "focus" | "reset"
msg.ui.action.target    = <node-id>  ← optionaler Ziel-Override (sonst löst der Zielknoten auf sich selbst auf); `targetId` als Alias
msg.ui.action.part      = <sub-id>    ← Granularität für open / close / select (Accordion-Sektion, Tree-Branch, Tab)
msg.ui.action.to        = <pfad>      ← Navigationsziel für `navigate` (Szenario 2; leer bei Verdrahtung zu einer ui-route)
msg.ui.action.params    = { k: v }    ← benannte URL-Parameter für `navigate` (füllen :platzhalter der Ziel-Route)
msg.ui.clientId         = <client>    ← schränkt die Action auf einen bestimmten Client ein
```

### Navigation: zwei Szenarien (P66 / ADR 0007 Amendment)

- **Szenario 1 — verdrahtet mit einer `ui-route`** (oder mit der `ui-app` für die
  implizite Root `/`): `to` leer; optionale `params`. Die Route baut die Location
  aus ihrem **eigenen `path`** + `params`. Kein Pfad-Drift bei Route-Umbenennung.
- **Szenario 2 — nicht verdrahtet:** `to` (typedInput) gesetzt; app-global an die
  `ui-app`, die die Location auflöst.

`onEnter` (und `onLeave` auf der verlassenen Route) wird in **beiden** Szenarien
beim Routen-Eintritt emittiert. Mehrdeutigkeit (verdrahtet **und** `to`),
fehlendes Ziel oder ein statischer toter Link werden zur Deploy-Zeit geprüft
(`webapp.js`, da der Wire für die per-Node-Editor-Validierung unsichtbar ist).

## Output

Der Output-Port emittiert die **mit `msg.ui.action` angereicherte `msg`**: Der
typisierte Befehl wird aus Konfiguration + msg-Overrides gebaut und in
`msg.ui.action` geschrieben; alle fremden `msg.*`- und `msg.ui.*`-Felder reisen
unverändert mit (ADR 0007 §1 — anreichern, nicht ersetzen). Der verdrahtete
Zielknoten verarbeitet das ihm bekannte Verb und führt den SSE-Push aus.

## Besonderheiten

- Den SSE-Push führt der **Zielknoten** aus, nicht `ui-action` (P59 / ADR 0007 §2).
- `ui-button` hat ab P20a keinen `action`-Verweis mehr — Klick-Events werden direkt auf dem Output-Port des Buttons ausgegeben und dann ggf. an `ui-action` weitergeleitet.
- `openDialog` / `closeDialog` werden als Aliase von `open` / `close` (ohne `part`) weiterhin akzeptiert (Abwärtskompatibilität, ADR 0005).
