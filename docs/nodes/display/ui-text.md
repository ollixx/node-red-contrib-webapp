# `ui-text`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-text` rendert einen **Textwert** an einem Mount-Ziel. Der angezeigte Wert ist
bindbar — er kann ein statisches Literal, ein reaktiver Store-Wert, ein
Query-Ergebnis, ein Routen-Parameter oder ein Node-RED-Kontext-Wert sein. Zwei
orthogonale Achsen steuern die Darstellung: `style` legt die **typografische
Rolle** fest (Überschrift, Lauftext, Label, Code …) und bestimmt damit das
gerenderte HTML-Element; `variant` legt die **semantische Farbe** fest (wie bei
`ui-button`/`ui-badge`/`ui-alert`). So lassen sich z. B. „Heading-1 in danger"
oder „Body in muted" aus demselben Knoten-Typ erzeugen.

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
| `value` | „Text" | typedInput (Binding) | **ja** | Der anzuzeigende Text. Die Wert-Quelle gehört zu **einer von drei** Kategorien (siehe „Wert-Quellen" unten): **reaktive Bindung** — `store` (Store-Picker, ui-store-gebunden), `query` (Query-Pfad in Dot-Bracket-Notation), `routeParam` (Routenparameter-Name); **statisch / serverseitig einmalig aufgelöst** — `literal` (statischer Text), `flow`/`global` (Kontext-Variable), `env` (Umgebungsvariable); **gepusht** — `msg` (Standard-Node-RED-Binding; Wert aus der konfigurierten Message-Property, z. B. `payload` oder `payload.label`). Binding-Serialisierung: [stores.md](../concepts/stores.md), [editor.md](../concepts/editor.md). Leer-/`null`-/Non-Skalar-Verhalten (`""` → leerer Text; `null`/`undefined`/Objekt/Array → `"?"`; `0`/`false` sind gültig): siehe [value-rendering.md](../concepts/value-rendering.md). |
| `style` | „Style" | SelectBox (`TEXT_STYLES`) | optional | Typografische **Rolle** des Textes; mappt 1:1 auf ein semantisches HTML-Element. Werte: `heading-1` (`<h1>`), `heading-2` (`<h2>`), `heading-3` (`<h3>`), `body` (`<p>`), `caption` (`<small>`), `label` (`<span>`), `code` (`<code>`). Default: `body`. Bestimmt Größe/Gewicht/Schriftfamilie, **nicht** die Farbe. |
| `variant` | „Variante" | Variant-SelectBox (`TEXT_COLOR_VARIANTS`) | optional | Semantische **Farbe** des Textes — gleiches Vokabular-Prinzip wie `ui-button`/`ui-badge`/`ui-alert`. Werte: `default` (erbt die Textfarbe), `muted`, `primary`, `success`, `warning`, `danger`, `neutral`. Default: `default`. Mappt auf die `--wa-color-*` Tokens — Details: [theming.md](../concepts/theming.md). |

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

## Wert-Quellen

Die `value`-Quelle fällt in genau **eine von drei Kategorien**, die konzeptionell
unterschiedlich sind:

1. **Reaktive Bindung** (`store`, `query`, `routeParam`) — der Text ist an einen
   *lebenden* Frontend-Wert gebunden und re-rendert, sobald sich dieser ändert.
   `store` bindet an einen `ui-store` (backend-synchron, reaktiv).
2. **Statisch / serverseitig einmalig** (`literal`, `flow`, `global`, `env`) — ein
   konkreter Wert. `flow`/`global`/`env` werden **serverseitig pro Render einmalig**
   aus dem Node-RED-Kontext bzw. der Umgebung aufgelöst und als Literal in den
   Snapshot geschrieben — **nicht reaktiv** (eine reine Kontextänderung ohne
   Re-Render aktualisiert den Text nicht).
3. **Gepusht** (`msg` — Standard-Node-RED-Binding) — der Text wird aus der
   konfigurierten Message-Property (z. B. `payload`, `payload.label`, `topic`) der
   an den Knoten gesendeten Nachrichten gelesen (siehe „Input"). Vor der ersten
   passenden Message rendert das Feld **leer** (nicht `"?"`). Der zuletzt gelesene
   Wert wird **backend-seitig** in der Live-Definition gehalten, von allen Clients
   geteilt und geht bei Redeploy/Neustart verloren — es wird **kein** `ui-store`
   benötigt.

> Die frühere Editor-Option `jsonata` wurde entfernt: der Renderer konnte sie nie
> auflösen (Ergebnis `"?"`). `msg` ist das normale Node-RED-Binding mit Pfad-Feld;
> der Wert wird über den Input-Handler aus der gewählten Message-Property gelesen.

## Input

`ui-text` nimmt Eingangs-Messages entgegen, um seinen Anzeigewert zur Laufzeit
zu aktualisieren (das ist der „Message"-Wert-Quellen-Modus).

- **`msg.payload` (primäres Feld):** Enthält `msg.payload` einen nicht-`null`-Wert,
  wird `value` auf diesen Wert gesetzt (backend-seitig gehalten) und ein frischer
  SSE-Snapshot an alle verbundenen Clients des Parent-App gesendet. Primäres Feld:
  `value` (angezeigter Text). Details: [inputs.md](../concepts/inputs.md).
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

`ui-text` trägt sein Theming über zwei Felder: `style` (`TEXT_STYLES`,
typografische Rolle) und `variant` (`TEXT_COLOR_VARIANTS`, semantische Farbe).
Die Rolle wird als semantisches HTML-Element plus `webapp-text--<rolle>`-Klasse
gerendert, die Farbe als `webapp-text--color-<farbe>`-Klasse; beide greifen auf
die `--wa-*`-Tokens zu (heute Shoelace, weitere Backends prinzipiell möglich).
Das Theme selbst wird an `ui-app` konfiguriert. Nicht gesetzte Tokens fallen auf
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
- [value-rendering.md](../concepts/value-rendering.md) — Verhalten bei leerem/`null`/nicht-skalarem Wert

## Offene Punkte

- Unterstützung von formatiertem Inline-Text (z. B. Bold/Italic-Spans) ist noch nicht modelliert.
- Mehrzeilige Textblöcke (Paragraphen-Rendering) vs. Einzeiler sind noch nicht spezifiziert.
