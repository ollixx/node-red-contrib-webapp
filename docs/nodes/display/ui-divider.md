# `ui-divider`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-divider` rendert eine **visuelle Trennlinie** zwischen Inhaltsbereichen —
horizontal oder vertikal, optional mit einem zentrierten Beschriftungs-Label.
Der Knoten ist rein darstellend; er emittiert keine Events und trägt keinen
eigenen Zustand.

## Einordnung

- **Parent:** `ui-app`, `ui-route`, `ui-dialog` oder `ui-container` — genau
  einer; gemountet über `mount` in einen Slot des Parents.
- **Kinder:** keine — `ui-divider` ist ein Blatt-Knoten.
- **Rolle zur Laufzeit:** der Renderer stellt die Trennlinie dar. Kein
  Event-Output, kein Binding.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (Mount-Baum,
Layout-Child-Props).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Divider N`. |
| `mount` | „Parent Slot" | Mount-Baum (Node-Picker-Dialog) | **ja** | Slot-Pfad des Parents (`<type>:<id>/<slot>`). Bestimmt die sichtbaren Layout-Child-Props (Gruppe „Platzierung"). |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `orientation` | „Ausrichtung" | SelectBox (`horizontal` / `vertical`) | optional | Ausrichtung der Linie. `horizontal` trennt vertikal gestapelte Inhalte; `vertical` trennt nebeneinanderliegende Bereiche. Default: `horizontal`. |
| `label` | „Label" | Textfeld | optional | Optionaler Text, der mittig auf der Linie angezeigt wird (z. B. „Oder", „Abschnitt A"). Statischer String; kein Binding. |

### Gruppe „Platzierung"

Die Felder dieser Gruppe werden vom Editor **abhängig vom gewählten Mount** eingeblendet:

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Position innerhalb von `horizontal`- und `vertical`-Layouts. |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (min 1) | optional | Grid-Position (1-basiert). Nur sichtbar bei `grid`-Layout. |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld (min 1) | optional | Grid-Spannweite. Nur sichtbar bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Koordinaten. Nur sichtbar bei `absolute`-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-divider"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Trennlinie, horizontal oder vertikal), Hinweis auf das optionale Label und
ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-divider.md`.

## Input

`ui-divider` hat **keinen Eingangs-Port**. Der Knoten ist statisch und wird
ausschließlich über seine Konfigurationsfelder gesteuert.

## Output

`ui-divider` hat **keinen Output-Port**. Der Knoten emittiert keine Events.

## Theming

`ui-divider` trägt kein eigenes `variant`-Feld. Farbe und Stärke der Linie
sowie die Typografie des Labels erbt der Divider vom App-weiten Theme
(Design-Tokens am `ui-app`-Knoten, insbesondere `colorBorder` und `colorText`).
Das Rendering-Backend (heute Shoelace) bildet die Konfiguration auf seine
Web-Component-Props ab; weitere Backends folgen demselben Contract. Details:
[theming.md](../concepts/theming.md).

## Referenzen

- [layout.md](../concepts/layout.md) — Presets und Child-Platzierungs-Felder
- [theming.md](../concepts/theming.md) — Design-Tokens und Backends
- [editor.md](../concepts/editor.md) — Editor-Typen (Mount-Baum)

## Offene Punkte

- Stärke (`thickness`) und Stil (`style`: `solid`, `dashed`, `dotted`) der Linie sind noch nicht im Schema modelliert.
- Bindung des `label`-Felds (typedInput) ist noch nicht vorgesehen; aktuell nur statischer String.
