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
| `src` | „Image" | typedInput (URL / Asset / Store / alle Binding-Arten) | optional | Bindbare Quelle des Avatar-Bilds. `URL` (literal), `Asset` (verwaltetes Medium aus dem Media-Store, wenn `ui-app.mediaStoreUrl` konfiguriert), `Store` (Bildpfad aus einem `ui-store`-Wert), oder alle anderen Binding-Arten. Wird aufgelöst und als `image`-Attribut von `sl-avatar` gesetzt. Schlägt der Ladevorgang fehl oder ist das Feld nicht gesetzt, greift die Fallback-Kette (→ `initials`). Früher als „Src Path" bezeichnet (Plain-Text-Feld, pre-P94); alte Flows werden automatisch migriert. |
| `initials` | „Fallback Initials" | typedInput (voller Binding-Satz) | optional | Bindbare Zeichenkette für den Initialen-Platzhalter (z. B. `"JD"`). Wird angezeigt, wenn kein Bild verfügbar ist. Ist auch kein Initialen-Wert vorhanden, greift der Icon-Fallback (`icon`). Nutzt den kanonischen Value-Binding-Typ-Satz (inkl. scope-lokaler Typen im passenden Scope) — siehe [stores.md](../concepts/stores.md#der-kanonische-value-binding-typ-satz-editor--adr-0012--adr-0010). Der aufgelöste Wert durchläuft **zuerst** die Fallback-Kette (Bild → Initialen → Icon), das Ergebnis dann die zentrale Normalisierung — siehe [value-rendering.md](../concepts/value-rendering.md) (§2-Ausnahme). |
| `icon` | „Fallback Icon" | Textfeld + Icon-Picker (P69) | optional | Backend-neutraler Icon-Wert `{ library, name }` (bzw. `library:name`), angezeigt wenn weder `src` noch `initials` aufgelöst werden. Bindbar. Details: [ui-icon.md](./ui-icon.md). |
| ~~`alt`~~ | ~~„Alt-Text"~~ | – | – | *Entfernt in P93.* `sl-avatar` nutzt das `label`-Attribut für Barrierefreiheit; ein separates `alt`-Feld wird nicht unterstützt. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `size` | „Größe" | SelectBox (`xs` / `sm` / `md` / `lg` / `xl`) | optional | Größe des Avatars. Default: `md`. `sl-avatar` hat kein natives `size`-Attribut → backend-bedingt: [backend-support.md](../concepts/backend-support.md). |
| `shape` | „Form" | SelectBox (`circle` / `square`) | optional | Form des Avatars. Default: `circle`. Nativ von `sl-avatar` unterstützt. |
| `variant` | „Variant" | SelectBox (`primary` / `neutral` / `success` / `info` / `warning` / `danger`) | optional | Semantische Farbrolle des Avatars (P94). `sl-avatar` unterstützt kein natives `variant` → backend-bedingt (Emission als `data-variant`, Editor-Warnung unter Trennlinie): [backend-support.md](../concepts/backend-support.md). |

### Gruppe „Platzierung"

Die Felder dieser Gruppe werden vom Editor **abhängig vom gewählten Mount** eingeblendet:

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Position innerhalb von `horizontal`- und `vertical`-Layouts. Default bei leerem Feld: Canvas-y (siehe layout.md). |
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

`ui-avatar` trägt ein `variant`-Feld für die semantische Farbrolle (P94). Farben
und Radii erben vom App-weiten Theme (Design-Tokens). Das Rendering-Backend (heute
Shoelace) bildet `shape` nativ ab; `size` und `variant` haben **kein** natives
`sl-avatar`-Pendant und sind backend-bedingt (`data-size` / `data-variant` +
Editor-Warnung). Das Verhalten ist zentral beschrieben in
[backend-support.md](../concepts/backend-support.md); Tokens/Vokabular in
[theming.md](../concepts/theming.md).

## Fallback-Reihenfolge

1. `src` ist gesetzt und das Bild lädt erfolgreich → Bild anzeigen.
2. `src` fehlt oder der Ladevorgang schlägt fehl → `initials` anzeigen (falls gesetzt).
3. Kein `initials`-Wert verfügbar → `icon`-Fallback anzeigen (falls gesetzt), backend-neutral `{ library, name }` (P69).

## Referenzen

- [layout.md](../concepts/layout.md) — Presets und Child-Platzierungs-Felder
- [theming.md](../concepts/theming.md) — Design-Tokens und Backends
- [backend-support.md](../concepts/backend-support.md) — nicht nativ unterstützte Felder (`size`, `variant`): `data-*`-Emission + Editor-Warnung
- [inputs.md](../concepts/inputs.md) — `msg.payload` / `msg.ui.patch` / Component-Ops
- [editor.md](../concepts/editor.md) — Editor-Typen (typedInput, Mount-Baum)
- [stores.md](../concepts/stores.md) — Binding-Arten
- [value-rendering.md](../concepts/value-rendering.md) — Verhalten bei leerem/`null`/nicht-skalarem Wert (Initialen nach der Fallback-Kette)

## Offene Punkte

- Klick-Interaktion (z. B. Profilbild-Upload, User-Menü öffnen) ist noch nicht modelliert.
- Der Icon-Fallback ist seit P69 backend-neutral spezifiziert (`{ library, name }`);
  ohne gesetztes `icon` zeigt das Backend weiterhin sein generisches Standard-Icon.
