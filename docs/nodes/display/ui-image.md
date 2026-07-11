# `ui-image`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-image` rendert ein **Bild** an einem Mount-Ziel. Die Bild-URL (`src`) ist
bindbar und kann damit dynamisch aus dem App-State, einer Query oder einem
Routen-Parameter stammen. Ergänzt wird der Knoten durch Alt-Text für
Barrierefreiheit, eine Fallback-URL für Ladefehler sowie Breite, Höhe und
Object-Fit-Modus für die visuelle Darstellung.

## Einordnung

- **Parent:** ein Slot eines `ui-app`-, `ui-route`-, `ui-dialog`- oder
  `ui-container`-Knotens. Deklariert über `mount` (Mount-Pfad `<type>:<id>/<slot>`)
  oder `parent` (direkte Parent-ID).
- **Kinder:** keine — `ui-image` ist ein Blatt-Knoten.
- **Erreichbarkeit:** als Teil des gerenderten Snapshots der Parent-Route bzw.
  des Parent-Dialogs.
- **Rolle zur Laufzeit:** der Renderer löst das `src`-Binding auf und liefert
  die resultierende URL samt Alt-Text, Dimensions- und Fit-Angaben als
  Bild-Komponente an den Client.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Image N`. |
| `mount` | „Parent Slot" | Mount-Picker (hierarchischer Baum) | **ja** | Mount-Ziel des Knotens. Auswahl aus dem Slot-Baum (`installReferenceSelectors({ mount: true })`). Gespeichert als Mount-Pfad `<type>:<id>/<slot>`. |

### Gruppe „Bild"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `src` | „Src" | typedInput (Binding) | **ja** | URL des Bildes. Bindbar über alle Standard-Binding-Arten: `literal` (statische URL), `state` (State-Pfad), `query` (Query-Pfad), `routeParam` (Routenparameter-Name), `store` (Store-Picker), `msg`/`flow`/`global`/`jsonata`/`env` sowie **`asset`** (verwaltetes Medium). Der `asset`-Typ öffnet den Media-Picker (Durchsuchen/Upload) und speichert die Auswahl als `literal` `asset:<id>`; sie wird zur Laufzeit über den Backend-Proxy der App aufgelöst (`ui-app.mediaStoreUrl`). Binding-Arten: [stores.md](../concepts/stores.md). |
| `alt` | „Alt Text" | Textfeld | optional | Alternativer Text für Barrierefreiheit (`alt`-Attribut). Sollte bei inhaltlich relevanten Bildern gesetzt sein; für rein dekorative Bilder leer lassen. |
| `fallbackSrc` | „Fallback URL" | Textfeld | optional | Statische URL, die angezeigt wird, wenn das Laden der `src` fehlschlägt. Kein Binding — muss eine zur Deploy-Zeit bekannte URL sein. |
| `width` | „Width" | Textfeld | optional | Breite der Bildkomponente. Ganzzahl (Pixel) oder CSS-String (z. B. `"100%"`, `"12rem"`). Fehlt das Feld, bestimmt das Parent-Layout die Breite. |
| `height` | „Height" | Textfeld | optional | Höhe der Bildkomponente. Ganzzahl (Pixel) oder CSS-String. Fehlt das Feld, ergibt sich die Höhe aus dem natürlichen Seitenverhältnis des Bildes bzw. dem Parent-Layout. |
| `fit` | „Fit" | SelectBox | optional | Object-Fit-Modus: `contain` (Bild vollständig sichtbar, Leerraum möglich), `cover` (Bild füllt den Bereich, ggf. abgeschnitten), `fill` (Strecken auf den Bereich), `none` (Originalgröße). Default: Browser-Default (`fill`). |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Reihenfolge innerhalb des Slots bei `horizontal`/`vertical`-Layout. Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (1-basiert) | optional | Gitter-Position bei `grid`-Layout (1-basiert). |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld | optional | Gitter-Spannweite bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Position bei `absolute`-Layout. |

Welche Platzierungsfelder sichtbar sind, hängt vom Layout-Preset des Parent-Slots ab — `installLayoutChildPropRows()` blendet sie dynamisch ein. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-image"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Bildanzeige mit Binding), Hinweis auf Fallback-URL und Fit-Modus sowie ein
Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-image.md`.

## Input

`ui-image` nimmt Eingangs-Messages entgegen, um seine Bild-URL zur Laufzeit zu
aktualisieren.

- **`msg.payload` (primäres Feld):** Enthält `msg.payload` einen nicht-`null`-Wert,
  wird `src` auf diesen Wert gesetzt und ein frischer SSE-Snapshot an alle
  verbundenen Clients der Parent-App gesendet. Primäres Feld: `src` (Bild-URL).
  - **String** (URL, `asset:<id>` oder fertige `data:`-URL) wird unverändert
    übernommen.
  - **Buffer** (wiring-first, z. B. aus HTTP-Request oder Datei-Read) wird in eine
    `data:`-URL konvertiert. Der Content-Type stammt aus `msg.contentType`
    (bzw. `msg.headers["content-type"]`) oder wird aus den Magic-Bytes ermittelt
    (PNG/JPEG/GIF/WEBP/SVG; Fallback `image/png`). **Caveat:** eine `data:`-/Base64-
    Quelle landet im Snapshot/State und wird bei **jedem** Render mitgeschickt —
    nur für kleine/seltene Bilder geeignet; große/häufige Bilder via URL/Asset.

  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`:** Überschreibt beliebige Felder der Knotendefinition (z. B.
  `src`, `alt`, `fit`, `width`, `height`). Binding-Felder (`src`) müssen als
  Binding-Objekt übergeben werden.
- **Component-State-Messages** (`msg.ui.component.op`): `show`, `hide`.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-image` hat **keinen Output-Port** — er ist ein reiner Anzeige-Knoten ohne
nutzerinitiierte Ereignisse.

## Theming

`ui-image` hat kein eigenes Varianten-Feld. Dimensionierung und Darstellungsform
werden über die Felder `width`, `height` und `fit` deklarativ gesteuert. Das
App-weite Theme (Design-Tokens, an `ui-app` konfiguriert) kann über Token-basierte
Abstands- und Rahmen-Variablen die Umgebung des Bildes beeinflussen, nicht jedoch
das Bild selbst. Details: [theming.md](../concepts/theming.md).

## Besonderheiten

- **Fallback-URL ist statisch.** `fallbackSrc` ist kein Binding, sondern eine
  zur Deploy-Zeit feststehende URL. Dynamische Fallbacks sind über das allgemeine
  `fallback`-Feld des Binding-Objekts erreichbar.
- **Dimensionsangaben sind flexibel.** `width` und `height` akzeptieren Ganzzahlen
  (Pixel) oder CSS-Strings. Das erlaubt responsive Angaben (`"100%"`, `"50vw"`)
  neben absoluten Werten.

## Referenzen

- [stores.md](../concepts/stores.md) — Binding-Arten für `src`
- [editor.md](../concepts/editor.md) — typedInput, Mount-Picker
- [inputs.md](../concepts/inputs.md) — `msg.payload`-Verhalten und `msg.ui.patch`
- [layout.md](../concepts/layout.md) — Platzierungsfelder und Layout-Presets
- [theming.md](../concepts/theming.md) — Design-Tokens

## Offene Punkte

- Lazy Loading (`loading="lazy"`) ist noch nicht modelliert.
- Responsive Srcset (`srcset`/`sizes`) für unterschiedliche Auflösungen ist noch nicht Teil des Contracts.
- Klick-Events auf das Bild (z. B. für Lightbox/Zoom) sind noch nicht spezifiziert.
