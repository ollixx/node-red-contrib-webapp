# `ui-empty-state`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-empty-state` rendert einen **strukturierten Platzhalter** für leere Listen,
fehlgeschlagene Ladevorgänge oder noch nicht vorhandene Inhalte. Der Knoten
erscheint, wenn das `visible`-Binding truthy ist — typischerweise wenn eine Liste
leer ist oder ein Query-Ladezustand keinen Inhalt zurückgegeben hat. Er kann einen
optionalen Call-to-Action-Button anzeigen, der mit einer `ui-action` verdrahtet ist.

## Einordnung

- **Parent:** eine Route, ein Dialog oder ein Container — via `mount`.
- **Kinder:** keine.
- **Rolle zur Laufzeit:** passives Anzeige-Element; sichtbar, solange `visible` truthy ist.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor. Default: fortlaufend `Empty State N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Slot, in den der Knoten gemountet wird (`<type>:<id>/<slot>`). |

### Gruppe „Sichtbarkeit"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `visible` | „Visible Path" | typedInput (Binding-Arten) | **ja** | Binding, das die Sichtbarkeit steuert. `true` = Empty State sichtbar (keine Daten / Fehlerfall). Unterstützt alle Binding-Arten (`literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`). Typischerweise ein `state`- oder `query`-Binding auf einen booleanen „isEmpty"-Wert. |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `icon` | „Icon" | Textfeld | optional | Icon-Name (aus dem Shoelace-Icon-Set oder einem konfigurierten Custom-Set). Leer gelassen → kein Icon. |
| `title` | „Title" | Textfeld | optional | Überschrift des Platzhalters (z. B. „Keine Einträge" oder „Noch keine Daten"). |
| `message` | „Message" | Textfeld | optional | Ergänzender beschreibender Text unter dem Titel. |

### Gruppe „Aktion"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `action` | „Action" | Node-Picker-Dialog (Preset `actions`) | optional | Referenziert eine `ui-action`-Knoten-ID. Wenn gesetzt, wird ein Call-to-Action-Button gerendert. |
| `actionLabel` | „Action Label" | Textfeld | optional | Beschriftung des CTA-Buttons. Wird nur angezeigt, wenn `action` gesetzt ist. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-empty-state"`-Hilfetext soll **knapp, aber ausreichend**
sein: Zweck in 1–2 Sätzen, Hinweis auf das `visible`-Binding (wann sichtbar) und
den optionalen CTA-Button sowie ein Link auf die ausführliche Doku. Empfohlener
Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/feedback/ui-empty-state.md`.

## Input

`ui-empty-state` hat einen **Input-Port** für Push-Updates aus dem Flow.

- **`msg.ui.patch`** — überschreibt beliebige Felder der Knoten-Definition
  (`icon`, `title`, `message`, `actionLabel`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert Sichtbarkeit und
  Interaktionszustand zusätzlich zum `visible`-Binding.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-empty-state` hat **keinen Output-Port** — der Knoten selbst erzeugt keine
Nutzer-Events. Klicks auf den CTA-Button lösen die verdrahtete `ui-action` aus;
deren Events entstehen dort.

## Theming

`ui-empty-state` hat keine eigenen `severity`- oder `variant`-Felder — der Knoten
übernimmt das Theme der Parent-App. Design-Tokens (`colorText`, `colorTextMuted`,
`fontFamily`, …) wirken auf alle Textelemente. Das Modell ist backend-neutral.

## Referenzen

- [editor.md](../concepts/editor.md) — Binding-Typen, Node-Picker-Dialog (Preset `actions`)
- [inputs.md](../concepts/inputs.md) — `msg.ui.patch` Push-Updates
- [`ui-action`](../behavior/ui-action.md) — Call-to-Action-Button

## Offene Punkte

- `title` und `message` sind heute Textfelder (keine typedInput-Bindings). Eine zukünftige Phase kann sie auf vollständige Bindings erweitern (analog `ui-alert`).
- Keine `severity`-Unterstützung (z. B. für Fehler- vs. Leer-Darstellung mit unterschiedlichen Farben).
