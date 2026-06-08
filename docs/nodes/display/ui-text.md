# `ui-text`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-text` rendert einen **Textwert** an einem Mount-Ziel. Der angezeigte Wert ist
bindbar — er kann ein statisches Literal, ein reaktiver State-Wert, ein
Query-Ergebnis, ein Routen-Parameter oder ein Node-RED-Kontext-Wert sein. Die
typografische Rolle wird über `variant` gesteuert; so lassen sich Überschriften,
Labels, Lauftext, Code und gedimmte Hinweistexte aus demselben Knoten-Typ
erzeugen.

## Einordnung

- **Parent:** ein Slot eines `ui-app`-, `ui-route`-, `ui-dialog`- oder
  `ui-container`-Knotens. Deklariert über `mount` (Mount-Pfad `<type>:<id>/<slot>`)
  oder `parent` (direkte Parent-ID).
- **Kinder:** keine — `ui-text` ist ein Blatt-Knoten.
- **Erreichbarkeit:** als Teil des gerenderten Snapshots der Parent-Route bzw.
  des Parent-Dialogs.
- **Rolle zur Laufzeit:** der Renderer löst das `value`-Binding auf und liefert
  den resultierenden String als Textknoteninhalt an den Client.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Text N`. |
| `mount` | „Parent Slot" | Mount-Picker (hierarchischer Baum) | **ja** | Mount-Ziel des Knotens. Auswahl aus dem Slot-Baum der bekannten Routes, Dialoge und Container (`installReferenceSelectors({ mount: true })`). Gespeichert als Mount-Pfad `<type>:<id>/<slot>`. |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `value` | „Text" | typedInput (Binding) | **ja** | Der anzuzeigende Text. Bindbar über alle Standard-Binding-Arten: `literal` (statischer Text), `state` (State-Pfad), `query` (Query-Pfad in Dot-Bracket-Notation), `routeParam` (Routenparameter-Name), `store` (Store-Picker), `msg`/`flow`/`global`/`jsonata`/`env`. Binding-Arten und Serialisierung: [stores.md](../concepts/stores.md), [editor.md](../concepts/editor.md). |
| `variant` | „Variante" | Variant-SelectBox (`TEXT_VARIANTS`) | optional | Typografische Rolle des Textes. Werte: `heading-1`, `heading-2`, `heading-3`, `body`, `caption`, `label`, `code`, `muted`. Default: `body`. Das Vokabular ist backend-neutral und im Schema als `TEXT_VARIANTS` festgeschrieben — Details: [theming.md](../concepts/theming.md). |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Reihenfolge innerhalb des Slots bei `horizontal`/`vertical`-Layout. |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (1-basiert) | optional | Gitter-Position bei `grid`-Layout (1-basiert). |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld | optional | Gitter-Spannweite bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Position bei `absolute`-Layout. |

Welche Platzierungsfelder sichtbar sind, hängt vom Layout-Preset des Parent-Slots ab — `installLayoutChildPropRows()` blendet sie dynamisch ein. Details: [layout.md](../concepts/layout.md).

### Inline-Hilfe (HTML)

Der `data-help-name="ui-text"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (Textanzeige mit Binding), kurze Übersicht der Binding-Arten, Query-Pfad-Syntax und
ein Link auf die ausführliche Doku. Empfohlener Link:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-text.md`.

## Input

`ui-text` nimmt Eingangs-Messages entgegen, um seinen Anzeigewert zur Laufzeit
zu aktualisieren.

- **`msg.payload` (primäres Feld):** Enthält `msg.payload` einen nicht-`null`-Wert,
  wird `value` auf diesen Wert gesetzt und ein frischer SSE-Snapshot an alle
  verbundenen Clients des Parent-App gesendet. Primäres Feld: `value` (angezeigter Text). Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.patch`:** Überschreibt beliebige Felder der Knotendefition (z. B.
  `value`, `variant`) — Binding-Felder müssen als Binding-Objekt übergeben werden.
- **Component-State-Messages** (`msg.ui.component.op`): `show`, `hide` — steuern
  die Sichtbarkeit des Knotens.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-text` hat **keinen Output-Port** — er ist ein reiner Anzeige-Knoten ohne
nutzerinitiierte Ereignisse.

## Theming

`ui-text` trägt sein Theming über das `variant`-Feld (`TEXT_VARIANTS`). Der
aktive Renderer-Adapter bildet die Variante auf die passenden Typografie-Tokens
(`--wa-*`) ab (heute Shoelace, weitere Backends prinzipiell möglich). Das Theme
selbst wird an `ui-app` konfiguriert. Nicht gesetzte Tokens fallen auf
System-Defaults zurück. Details: [theming.md](../concepts/theming.md).

## Besonderheiten

- **Binding-Serialisierung.** Das typedInput und das gespeicherte Binding-Objekt
  (`value`) sind zwei getrennte Felder (`text` im Editor, `value` im Knoten-Defaults).
  Beim Speichern baut `oneditsave` das Binding-Objekt aus dem typedInput-Typ und
  -Wert zusammen. Dieses Muster verhindert, dass Node-REDs Defaults-Auto-Übernahme
  das Binding-Objekt durch den rohen typedInput-String überschreibt.
- **Kein Markup.** `ui-text` gibt Plaintext aus. Formatierter Inline-HTML ist
  nicht Teil des Contracts; strukturierte Inhalte gehören in spezialisierte Knoten.

## Referenzen

- [stores.md](../concepts/stores.md) — Binding-Arten (literal/state/query/routeParam/store/…)
- [editor.md](../concepts/editor.md) — typedInput, Variant-SelectBox, Mount-Picker
- [theming.md](../concepts/theming.md) — `TEXT_VARIANTS`, Design-Tokens
- [inputs.md](../concepts/inputs.md) — `msg.payload`-Verhalten und `msg.ui.patch`
- [layout.md](../concepts/layout.md) — Platzierungsfelder und Layout-Presets

## Offene Punkte

- Unterstützung von formatiertem Inline-Text (z. B. Bold/Italic-Spans) ist noch nicht modelliert.
- Mehrzeilige Textblöcke (Paragraphen-Rendering) vs. Einzeiler sind noch nicht spezifiziert.
