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
| `value` | (typedInput, Default `string`) | typedInput (Binding) | **ja** | Der anzuzeigende Wert. Nutzt den **kanonischen Value-Binding-Typ-Satz** (P113 / ADR 0012 / ADR 0010) — Reihenfolge + Semantik in [editor.md](../concepts/editor.md) und [stores.md](../concepts/stores.md), Kategorien unter „Wert-Quellen" unten. Binding-Serialisierung kommt aus dem gemeinsamen Helfer (`valueBindingTypes`/`readValueBinding`/`applyValueBinding`). Scope-lokale Typen (`item`, `index` bei `ui-repeat`; `prop` in einer Component-Definition) erscheinen zusätzlich im Dropdown, wenn der Knoten im passenden Scope hängt — auf einem freistehenden `ui-text` sind sie by design ausgeblendet (P182, [stores.md → Scope-lokale Binding-Arten](../concepts/stores.md#scope-lokale-binding-arten-p182-adr-0017--adr-0020)). Leer-/`null`-/Non-Skalar-Verhalten (`""` → leerer Text; `null`/`undefined`/Objekt/Array → `"?"`; `0`/`false` sind gültig): siehe [value-rendering.md](../concepts/value-rendering.md). |
| `style` | „Style" | SelectBox (`TEXT_STYLES`) | optional | Typografische **Rolle** des Textes; mappt 1:1 auf ein semantisches HTML-Element. Werte: `heading-1` (`<h1>`), `heading-2` (`<h2>`), `heading-3` (`<h3>`), `body` (`<p>`), `caption` (`<small>`), `label` (`<span>`), `code` (`<code>`). Default: `body`. Bestimmt Größe/Gewicht/Schriftfamilie, **nicht** die Farbe. |
| `variant` | „Variante" | Variant-SelectBox (`TEXT_COLOR_VARIANTS`) | optional | Semantische **Farbe** des Textes — gleiches Vokabular-Prinzip wie `ui-button`/`ui-badge`/`ui-alert`. Werte: `default` (erbt die Textfarbe), `muted`, `primary`, `success`, `warning`, `danger`, `neutral`. Default: `default`. Mappt auf die `--wa-color-*` Tokens — Details: [theming.md](../concepts/theming.md). |
| `display` | „Display" | SelectBox (`TEXT_DISPLAY_MODES`) | optional | **Präsentationsmodus** (P221, [ADR 0035](../../adr/0035-ui-text-form-field-readonly-mode.md)). Werte: `text` (Default) = bisheriger **freier Anzeigetext** (`style`/`variant` bestimmen Element + Farbe); `formField` = **read-only gelabelte Formular-Zeile** (`label` links, gebundener Wert rechts) mit **derselben Feld-Layout- und Typo-Optik wie die Input-Controls** (gerendert als `<sl-input readonly>`), sodass der Knoten in einem Formular neben `ui-input`/`ui-select` bündig sitzt. Der Modus ist reine Anzeige: **keine Editierbarkeit, keine Wert-Emission, kein Input-Event**. Der Wert wird wie im Textmodus über `value` gebunden (inkl. `store`-subPath), z. B. `store:EntityEditor._id`. Leer-Verhalten folgt ADR 0032: ist der gebundene Wert (noch) leer, bleibt die Wert-Zelle **leer** (kein `"?"`), das `label` bleibt sichtbar. Rendert als plain natives `<select>` (kein Hidden-Carrier → kein ADR-0031-Round-Trip nötig). |
| `label` | „Field Label" | Textfeld | optional | **Nur relevant bei `display: "formField"`** (Abhängigkeit von `display` — der Editor blendet die Zeile nur im Form-Feld-Modus ein). Beschriftung links neben dem Wert, füllt den Label-Slot des Controls (analog `ui-input`-`label`). Im Default-Modus (`text`) ohne Wirkung. Default: leer. |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Reihenfolge innerhalb des Slots bei `horizontal`/`vertical`-Layout. Default bei leerem Feld: Canvas-y (siehe layout.md). |
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

Seit **P113 (ADR 0012 / ADR 0010)** nutzt `value` den **kanonischen
Value-Binding-Typ-Satz** (14 Typen in fester Reihenfolge; Default `string`) —
siehe [editor.md](../concepts/editor.md) und [stores.md](../concepts/stores.md).
Die Quellen fallen konzeptionell in **fünf Kategorien**:

1. **Reaktive Bindung** (`store`, `query`, `routeParam`, `reactive`) — der Text ist
   an einen *lebenden* Frontend-Wert gebunden und re-rendert, sobald sich dieser
   ändert. `store` bindet an einen `ui-store` (backend-synchron, reaktiv);
   `reactive` ist ein clientseitiger JS-Ausdruck über `routeParam`/`store(…)`/
   `query(…)` (z. B. `` `Kunde ${routeParam.id}` ``) — [reactive-expressions.md](../concepts/reactive-expressions.md).
2. **Statisch** (`string`, `number`, `boolean`, `json`, `timestamp`) — ein konkreter
   Literalwert. Anzeige nach [value-rendering.md](../concepts/value-rendering.md).
3. **Serverseitig einmalig** (`flow`, `global`, `env`) — pro Render einmalig aus dem
   Node-RED-Kontext bzw. der Umgebung aufgelöst, als Literal in den Snapshot
   geschrieben — **nicht reaktiv**.
4. **Message-getrieben** (`msg`, `jsonata`) — der Text wird aus der eingehenden
   Message gelesen: `msg` aus der konfigurierten Property (z. B. `payload`,
   `payload.label`), `jsonata` als **Ausdruck gegen die `msg`** (z. B.
   `payload.user.name`). Vor der ersten passenden Message rendert das Feld **leer**
   (nicht `"?"`); der zuletzt gelesene/ausgewertete Wert wird **backend-seitig** in
   der Live-Definition gehalten und von allen Clients geteilt.
5. **Scope-lokal** (`item`, `index`, `prop`) — erscheint **nur im Editor**, wenn der
   Knoten (transitiv) in einem `ui-repeat` (`item`/`index`) oder einer
   Component-Definition (`prop`) hängt. Auf einem freistehenden `ui-text` sind diese
   Typen by design ausgeblendet — kein Fehler, sondern absichtliches Kontext-Gating
   (P182). Details: [stores.md → Scope-lokale Binding-Arten](../concepts/stores.md#scope-lokale-binding-arten-p182-adr-0017--adr-0020).

> **P113-Umkehr:** Die Editor-Option `jsonata` war mit P111 entfernt worden (damals
> nicht auflösbar) und **kehrt mit P113 zurück** — nun **message-getrieben** (gegen
> die eingehende `msg` ausgewertet, via `RED.util.prepareJSONataExpression` +
> asynchronem `evaluateJSONataExpression`). Neu hinzu kommt `reactive`. `state`
> bleibt **draußen** (renderer-/schema-seitig für Altbestände weiter unterstützt).

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
- **Form-Feld-Modus (P221, [ADR 0035](../../adr/0035-ui-text-form-field-readonly-mode.md)).**
  `display: "formField"` gibt denselben `value`-Wert als **read-only gelabelte
  Zeile** aus, gestylt wie die Input-Controls (`<sl-input readonly>`), damit ein
  Anzeigewert (z. B. das `_id`-Feld im Entity Editor) bündig neben `ui-input`/
  `ui-select` in ein Formular passt. Es bleibt reine Anzeige (keine Editierbarkeit,
  keine Emission). `label` liefert die linke Beschriftung und ist nur in diesem
  Modus relevant. Im Default `display: "text"` ist das Rendering unverändert.

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
