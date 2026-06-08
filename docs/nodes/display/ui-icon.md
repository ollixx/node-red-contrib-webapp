# `ui-icon`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-icon` rendert ein **Icon per symbolischen Namen** — icon-set-agnostisch. Das
Renderer-Backend bestimmt, welches Icon-Set (z. B. Shoelace-System-Icons,
Heroicons, Lucide) verwendet wird; der Knoten selbst kennt nur den semantischen
Icon-Namen. Der Knoten ist rein darstellend; er emittiert keine Events.

## Einordnung

- **Parent:** `ui-app`, `ui-route`, `ui-dialog` oder `ui-container` — genau
  einer; gemountet über `mount` in einen Slot des Parents.
- **Kinder:** keine — `ui-icon` ist ein Blatt-Knoten.
- **Rolle zur Laufzeit:** der Renderer löst den Icon-Namen gegen das aktive
  Icon-Set auf und stellt das Icon in der konfigurierten Größe und Farbe dar.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (Mount-Baum,
Layout-Child-Props).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Icon N`. |
| `mount` | „Parent Slot" | Mount-Baum (Node-Picker-Dialog) | **ja** | Slot-Pfad des Parents (`<type>:<id>/<slot>`). Bestimmt die sichtbaren Layout-Child-Props (Gruppe „Platzierung"). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `icon` | „Icon Name" | Textfeld | **ja** | Symbolischer Name des Icons (z. B. `home`, `user`, `check`, `trash`). Darf nicht leer sein. Das Renderer-Backend löst den Namen gegen das aktive Icon-Set auf. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `size` | „Größe" | SelectBox (`xs` / `sm` / `md` / `lg` / `xl`) | optional | Größe des Icons. Default: `md`. Das Backend übersetzt die Größenstufe in eine konkrete Pixel- oder em-Größe. |
| `color` | „Farbe" | Textfeld | optional | Farbe des Icons als CSS-Wert (z. B. `#ff0000`, `red`) oder Design-Token-Name. Ist kein Wert gesetzt, erbt das Icon die Text-/Icon-Farbe des umgebenden Themes (`colorText`). |

### Gruppe „Platzierung"

Die Felder dieser Gruppe werden vom Editor **abhängig vom gewählten Mount** eingeblendet:

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Position innerhalb von `horizontal`- und `vertical`-Layouts. |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (min 1) | optional | Grid-Position (1-basiert). Nur sichtbar bei `grid`-Layout. |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld (min 1) | optional | Grid-Spannweite. Nur sichtbar bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Koordinaten. Nur sichtbar bei `absolute`-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-icon"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Icon per symbolischen Namen, backend-agnostisch), Hinweis auf Icon-Name-Vokabular,
`size` und `color` und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-icon.md`.

## Input

`ui-icon` hat einen **Eingangs-Port**, der folgende Messages akzeptiert:

- **`msg.ui.component.op`** (`show` / `hide`): blendet das Icon ein oder aus,
  ohne die Konfiguration zu verändern.
- **`msg.ui.patch`**: überschreibt beliebige Felder der Knoten-Definition
  (z. B. `icon`, `size`, `color`).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

`ui-icon` definiert **kein** primäres `msg.payload`-Feld — er hat keinen
einzelnen darstellbaren Hauptwert, der per Payload gesetzt würde.

## Output

`ui-icon` hat **keinen Output-Port**. Der Knoten ist rein darstellend und
emittiert keine Events.

## Theming

`ui-icon` trägt kein eigenes `variant`-Feld. Größe und Farbe werden über `size`
und `color` gesteuert; nicht gesetzte Farbe erbt das Icon aus dem App-weiten
Theme (`colorText`, [theming.md](../concepts/theming.md)). Das Rendering-Backend
(heute Shoelace) bildet die Konfiguration auf seinen Icon-Mechanismus ab; weitere
Backends folgen demselben semantischen Contract.

## Besonderheiten

- **Icon-Set-Agnostizität.** Der `icon`-Name gehört zu einem semantischen
  Vokabular, das unabhängig vom verwendeten Icon-Set ist. Das Renderer-Backend
  ist dafür verantwortlich, den Namen auf das konkrete Icon seiner Bibliothek
  abzubilden. Flow-Autoren sollen Icon-Namen aus einem abgestimmten Vokabular
  wählen, damit ein späterer Backend-Wechsel keine Flow-Änderungen erfordert.

## Referenzen

- [layout.md](../concepts/layout.md) — Presets und Child-Platzierungs-Felder
- [theming.md](../concepts/theming.md) — Design-Tokens und Backends
- [inputs.md](../concepts/inputs.md) — Component-Ops (`show`/`hide`)
- [editor.md](../concepts/editor.md) — Editor-Typen (Mount-Baum)

## Offene Punkte

- Das kanonische Icon-Namens-Vokabular und die Alias-Mapping-Strategie zwischen
  Backends (z. B. Shoelace → Heroicons) sind noch nicht spezifiziert.
- Klickbarkeit (`clickable`, Emittieren eines `click`-Events) ist noch nicht modelliert;
  aktuell ist `ui-icon` immer rein dekorativ.
- Animation (z. B. Spinner-Modus) ist noch nicht im Schema.
