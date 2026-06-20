# `ui-container`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-container` ist ein **Layout-Container** innerhalb einer Route, eines Dialogs
oder eines anderen Containers. Er montiert sich in einen Slot seines Parents und
stellt seinerseits ein eigenes Kind-Layout (Layout-Preset) bereit, in das weitere
View-Knoten gemountet werden können. Auf diese Weise entstehen beliebig tief
verschachtelte UI-Strukturen, ohne dass Slot-Pfade künstlich verlängert werden
müssen.

Darüber hinaus ist `ui-container` die einzige Struktur-Ebene unterhalb von Route
und Dialog, die selbst **Sichtbarkeits-Events** emittieren kann (`onShow`,
`onHide`).

## Einordnung

- **Parent:** `ui-app`, `ui-route`, `ui-dialog` oder ein weiterer
  `ui-container` — genau einer; gemountet über `mount`.
- **Kinder:** View-Knoten mounten über `mount` in die Slots des Containers
  (`container:<id>/content`, sowie weitere Slots je nach Preset).
- **Rolle zur Laufzeit:** der Renderer rendert den Container als Fläche mit dem
  gewählten Variant-Stil und ordnet die Kinder gemäß dem konfigurierten
  Kind-Layout an.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (Node-Picker-Dialog,
Variant-SelectBox, Layout-SelectBox, Event-Checkboxen, Mount-Baum,
Layout-Child-Props).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Container N`. |
| `mount` | „Parent Slot" | Mount-Baum (Node-Picker-Dialog) | **ja** | Slot-Pfad des Parents (`<type>:<id>/<slot>`). Bestimmt die sichtbaren Layout-Child-Props (Gruppe „Platzierung"). |

### Gruppe „Layout"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `layoutId` | „Child Layout" | SelectBox (Layout-Preset) | **ja** | Preset, nach dem die direkten Kinder dieses Containers angeordnet werden. Auswahl aus `vertical`, `horizontal`, `app`, `grid`, `absolute`. Default: `vertical`. Bestimmt die verfügbaren Kinder-Slots und deren Platzierungs-Felder. Die SelectBox schreibt den gewählten Preset in das Feld `layoutId`. Details: [layout.md](../concepts/layout.md). |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `variant` | „Variante" | Variant-SelectBox (`CONTAINER_VARIANTS`) | optional | Semantische Flächen-Rolle des Containers: `card`, `panel`, `section`, `transparent`, `span`. Default: `card`. Das Rendering-Backend übersetzt die Variante in die passende visuelle Darstellung (Schatten, Hintergrund, Rahmen). Details: [theming.md](../concepts/theming.md). |

### Gruppe „Events"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `events` | „Events" | Event-Checkboxen → Output-Ports | optional | Aktivierbare Ausgangs-Events: `onShow`, `onHide`. Jedes aktive Event erzeugt einen Output-Port (Reihenfolge = Listenreihenfolge). Siehe Abschnitt „Output". |

### Gruppe „Platzierung"

Die Felder dieser Gruppe werden vom Editor **abhängig vom gewählten Mount** eingeblendet:

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Position innerhalb von `horizontal`- und `vertical`-Layouts. |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (min 1) | optional | Grid-Position (1-basiert). Nur sichtbar bei `grid`-Layout des Parents. |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld (min 1) | optional | Grid-Spannweite. Nur sichtbar bei `grid`-Layout des Parents. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Koordinaten. Nur sichtbar bei `absolute`-Layout des Parents. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-container"`-Hilfetext soll **knapp, aber ausreichend**
sein: Zweck (Layout-Container, verschachtelte Struktur), Hinweis auf `variant`
(Flächen-Stil), Hinweis auf `onShow`/`onHide`-Events und ein Link auf die
ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-container.md`.

## Input

`ui-container` hat einen **Eingangs-Port**, der folgende Messages akzeptiert:

- **`msg.ui.component.op`** (`show` / `hide`): blendet den Container (und alle
  seine Kinder) ein oder aus. Ein ausgeblendeter Container emittiert beim
  Ausblenden das `onHide`-Event (sofern aktiviert) und beim Einblenden das
  `onShow`-Event.
- **`msg.ui.patch`**: überschreibt beliebige Felder der Knoten-Definition
  (z. B. `variant`).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

`ui-container` akzeptiert **kein** `msg.payload` als primäres Feld — er hat
keinen primären darstellbaren Wert.

## Output

Pro aktivem Event ein Output-Port. Emittiert wird, wenn der Container ein- oder
ausgeblendet wird:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `onShow` | Container wird sichtbar (nach `show`-Op oder initialem Rendern) | `event: "onShow"`, `sourceId`, `appId`, `clientId` | Lazy-Daten laden, Animation starten |
| `onHide` | Container wird ausgeblendet (nach `hide`-Op) | `event: "onHide"`, `sourceId`, `appId`, `clientId` | Ressourcen freigeben, Entwurf verwerfen |

**Antizipierte Wiring-Szenarien:**

- `onShow` → `ui-query`/`function`, das die Daten des Containers erst bei
  Bedarf lädt (Lazy-Loading).
- `onHide` → Aufräumen (z. B. Entwurfszustand zurücksetzen).
- `msg.ui.component.op: "hide"` von einem `ui-button`-Click → Container
  ausblenden.

## Theming

`ui-container` trägt eine echte **Ebene-2-Variante** (`variant`). Die Variante
beschreibt die semantische Flächen-Rolle; das Rendering-Backend (heute Shoelace)
bildet sie auf die passende visuelle Darstellung ab. Das App-weite Theme
(Design-Tokens am `ui-app`-Knoten) bestimmt, wie `card`, `panel` usw. konkret
aussehen. Weitere Backends folgen demselben semantischen Contract. Details:
[theming.md](../concepts/theming.md).

### Visuelle Bedeutung der 5 Varianten (Shoelace-Backend)

| Variante | Element | Optik | Einsatz |
|---|---|---|---|
| `card` | `<sl-card>` | Shoelace-Card: Rand, Padding, leichte Elevation (Standard) | Inhaltsblöcke mit eigenem Gewicht |
| `panel` | `<div>` | 1 px Rand (`--wa-color-border`), moderates Padding, KEINE Elevation | Leichte Gruppenrahmen ohne Card-Schatten |
| `section` | `<div>` | Kein Rand, kein Hintergrund — nur vertikaler Abstand | Logische Abschnitte ohne Box-Chrome |
| `transparent` | `<div>` | Absolut kein Chrome: kein Rand, kein Padding, kein Hintergrund | Reines Layout-Grouping (Platzneutral) |
| `span` | `<span>` | Inline-Fluss: Kinder fließen inline nebeneinander, kein Block-Wrapper | Mehrere `ui-text` zu einer Textzeile komponieren; Repeat-Items ohne div pro Item |

`card` ist der Standard und bleibt rückwärtskompatibel. `transparent` ist das
Gegenteil: es fügt im DOM **keinen visuellen Rahmen** hinzu und eignet sich
ausschließlich als Layout-Wrapper, wenn mehrere Kinder gemeinsam platziert
werden sollen, ohne eine eigene Fläche zu erzeugen.

## Referenzen

- [layout.md](../concepts/layout.md) — Presets, Slots und Child-Platzierungs-Felder
- [theming.md](../concepts/theming.md) — Variant-Vokabular (`CONTAINER_VARIANTS`) und Backends
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [inputs.md](../concepts/inputs.md) — Component-Ops (`show`/`hide`)
- [editor.md](../concepts/editor.md) — Editor-Typen (Variant-SelectBox, Layout-SelectBox, Event-Checkboxen)
- [composition.md](../concepts/composition.md) — Naht-Verträge: Scope-Propagation, Mount-Eindeutigkeit, Re-Id, Slot-Layout (ADR 0024)

## Offene Punkte

- Per-Client-Sichtbarkeitssteuerung (ein Container für Client A sichtbar, für Client B nicht) ist noch nicht modelliert — heute gilt `show`/`hide` für alle Clients (Broadcast).
- Animations-/Übergangs-Konfiguration für Ein-/Ausblenden ist noch nicht im Schema.
