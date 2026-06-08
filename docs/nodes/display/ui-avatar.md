# `ui-avatar`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-avatar` zeigt ein **Benutzer-Bild** oder — als Fallback — **Initialen** an.
Ist weder ein Bild noch ein Initialien-Wert verfügbar, rendert der Renderer ein
generisches Nutzer-Icon. Der Knoten ist rein darstellend; er emittiert keine
Events.

## Einordnung

- **Parent:** `ui-app`, `ui-route`, `ui-dialog` oder `ui-container` — genau
  einer; gemountet über `mount` in einen Slot des Parents.
- **Kinder:** keine — `ui-avatar` ist ein Blatt-Knoten.
- **Rolle zur Laufzeit:** der Renderer löst die Bindings für `src` und
  `initials` auf und stellt die Fallback-Kette sicher. Kein Event-Output.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (Node-Picker-Dialog,
typedInput, Mount-Baum, Layout-Child-Props).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Avatar N`. |
| `mount` | „Parent Slot" | Mount-Baum (Node-Picker-Dialog) | **ja** | Slot-Pfad des Parents, in den der Avatar gemountet wird (`<type>:<id>/<slot>`). Bestimmt zugleich die sichtbaren Layout-Child-Props (Gruppe „Platzierung"). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `src` | „Bild-URL" | typedInput (alle Binding-Arten) | optional | Bindbare URL des Avatar-Bilds. Wird aufgelöst und als `<img>`-Quelle genutzt. Schlägt der Ladevorgang fehl oder ist `src` nicht gesetzt, greift die Fallback-Kette (→ `initials`). |
| `initials` | „Initialen (Fallback)" | typedInput (alle Binding-Arten) | optional | Bindbare Zeichenkette, die als Initialen-Platzhalter angezeigt wird, wenn kein Bild verfügbar ist (z. B. `"JD"`). Ist auch kein Initialen-Wert vorhanden, greift der Icon-Fallback (`icon`). |
| `icon` | „Fallback Icon" | Textfeld + Icon-Picker (P69) | optional | Backend-neutraler Icon-Wert `{ library, name }` (bzw. `library:name`), angezeigt wenn weder `src` noch `initials` aufgelöst werden. Bindbar. Details: [ui-icon.md](./ui-icon.md). |
| ~~`alt`~~ | ~~„Alt-Text"~~ | – | – | *Entfernt in P93.* `sl-avatar` nutzt das `label`-Attribut für Barrierefreiheit; ein separates `alt`-Feld wird nicht unterstützt. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `size` | „Größe" | SelectBox (`xs` / `sm` / `md` / `lg` / `xl`) | optional | Größe des Avatars. Default: `md`. |
| `shape` | „Form" | SelectBox (`circle` / `square`) | optional | Form des Avatars. Default: `circle`. |

### Gruppe „Platzierung"

Die Felder dieser Gruppe werden vom Editor **abhängig vom gewählten Mount** eingeblendet:

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Position innerhalb von `horizontal`- und `vertical`-Layouts. |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (min 1) | optional | Grid-Position (1-basiert). Nur sichtbar bei `grid`-Layout. |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld (min 1) | optional | Grid-Spannweite. Nur sichtbar bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Koordinaten. Nur sichtbar bei `absolute`-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-avatar"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Avatar-Bild oder Initialen-Fallback), Hinweis auf die Fallback-Kette
(`src` → `initials` → Icon), ein Hinweis auf die Binding-Typen und ein Link auf
die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-avatar.md`.

## Input

`ui-avatar` hat einen **Eingangs-Port**, der zwei Arten von Messages akzeptiert:

- **`msg.payload`** (nicht-null): überschreibt `src` (die primäre bindbare URL)
  sofort und pusht einen aktualisierten Snapshot an alle verbundenen Clients.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** (`show` / `hide`): blendet den Avatar ein oder aus,
  ohne das Binding zu verändern.
- **`msg.ui.patch`**: überschreibt beliebige Felder der Knoten-Definition
  (Binding-Felder als Binding-Objekt, z. B.
  `{ "kind": "literal", "value": "https://…" }`).
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-avatar` hat **keinen Output-Port**. Der Knoten ist rein darstellend.

## Theming

`ui-avatar` trägt kein eigenes `variant`-Feld — Form und Größe werden über
`shape` und `size` gesteuert. Farben und Radii erbt der Avatar vom App-weiten
Theme (Design-Tokens). Das Rendering-Backend (heute Shoelace) bildet `shape` und
`size` auf seine Web-Component-Props ab; weitere Backends folgen demselben
semantischen Contract. Details: [theming.md](../concepts/theming.md).

## Fallback-Reihenfolge

1. `src` ist gesetzt und das Bild lädt erfolgreich → Bild anzeigen.
2. `src` fehlt oder der Ladevorgang schlägt fehl → `initials` anzeigen (falls gesetzt).
3. Kein `initials`-Wert verfügbar → `icon`-Fallback anzeigen (falls gesetzt), backend-neutral `{ library, name }` (P69).

## Referenzen

- [layout.md](../concepts/layout.md) — Presets und Child-Platzierungs-Felder
- [theming.md](../concepts/theming.md) — Design-Tokens und Backends
- [inputs.md](../concepts/inputs.md) — `msg.payload` / `msg.ui.patch` / Component-Ops
- [editor.md](../concepts/editor.md) — Editor-Typen (typedInput, Mount-Baum)
- [stores.md](../concepts/stores.md) — Binding-Arten

## Offene Punkte

- Klick-Interaktion (z. B. Profilbild-Upload, User-Menü öffnen) ist noch nicht modelliert.
- Der Icon-Fallback ist seit P69 backend-neutral spezifiziert (`{ library, name }`);
  ohne gesetztes `icon` zeigt das Backend weiterhin sein generisches Standard-Icon.
