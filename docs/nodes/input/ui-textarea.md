# `ui-textarea`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-textarea` rendert ein mehrzeiliges Texteingabefeld. Die sichtbare Zeilenzahl
und eine optionale maximale Zeichenanzahl sind konfigurierbar; bei aktivem
`maxLength` zeigt das Feld einen Zeichenzähler an. Bei Änderungen emittiert der
Knoten `change`-Events; beim Absenden (Strg+Enter oder Submit) ein `submit`-Event.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder vorgeben.
- **Rolle zur Laufzeit:** liest `value` (Text) aus dem Client-State; schreibt
  Nutzeränderungen zurück. Gibt `change`- und `submit`-Events auf dem Output-Port
  aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Textarea N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | Textfeld | **ja** | Beschriftung des Texteingabefeldes. Wird als Feld-Label über dem Textarea angezeigt. |
| `value` | „Value Path" | typedInput (alle Binding-Arten) | **ja** | Bindbare Quelle des Textinhalts. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `placeholder` | „Placeholder" | Textfeld | optional | Platzhaltertext, der angezeigt wird, wenn das Feld leer ist. |
| `rows` | „Rows" | Zahlfeld (≥ 1) | optional | Anzahl der sichtbaren Textzeilen (Höhe des Feldes). Wenn nicht gesetzt, verwendet das Backend seinen Standard-Default. |
| `maxLength` | „Max Length" | Zahlfeld (≥ 1) | optional | Maximale Anzahl erlaubter Zeichen. Wenn gesetzt, wird ein Zeichenzähler eingeblendet; Eingaben über die Grenze hinaus werden verhindert. |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die das Feld deaktiviert (Nutzereingabe gesperrt). |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlfeld | optional | Reihenfolge im Parent-Slot (horizontal/vertical Layout). |
| `row` / `col` | „Row" / „Col" | Zahlfeld (≥ 1) | optional | Startposition im Grid-Layout (1-basiert). |
| `colSize` / `rowSize` | „Col Span" / „Row Span" | Zahlfeld (≥ 1) | optional | Spalten-/Zeilenspanne im Grid-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlfeld | optional | Pixelkoordinaten im Absolute-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-textarea"`-Hilfetext soll knapp sein: Zweck (mehrzeiliges
Textfeld), Hinweis auf `rows` und `maxLength` (Zeichenzähler), `change`- und
`submit`-Events und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-textarea.md`.

## Input

`ui-textarea` hat einen **Eingangs-Port**, über den der Flow den Textinhalt und
den Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld des Knotens und
  sendet einen frischen Snapshot an alle verbundenen Clients der App.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition
  (z. B. `placeholder`, `rows`, `maxLength`, `disabled`). Binding-behaftete
  Felder (`value`) müssen als Binding-Objekt übergeben werden.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Eingabe freigeben / sperren
  - `focus` — Fokus auf das Feld setzen
  - `reset` — Feldinhalt auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-textarea` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzereingabe (jede Änderung des Textinhalts) | `value` — der aktuelle Textinhalt | Validierung, Auto-Speichern, Live-Vorschau |
| `submit` | Strg+Enter / Submit-Auslösung | `value` — der bestätigte Textinhalt | Kommentar abschicken, Freitext speichern |

Gemeinsame `msg.ui`-Felder beider Events: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `ui-store` (Entwurf speichern, z. B. `commentDraft`).
- `submit` → `http request` → Kommentar/Notiz an API senden.
- `submit` → `ui-action` (`reset`) → Feld nach erfolgreichem Absenden leeren.

## Theming

`ui-textarea` trägt kein eigenes `variant`-Feld — es erbt Theme-Tokens der
Parent-App. Das Theme wird von `ui-app` über Design-Tokens vorgegeben;
das Backend bildet sie auf die Textarea-Darstellung ab. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **Zeichenzähler.** Wenn `maxLength` gesetzt ist, zeigt das Feld einen
  Zeichenzähler (z. B. „43 / 200"). Die Eingabe wird bei Erreichen der
  Grenze verhindert.
- **Submit-Geste.** Die `submit`-Geste (Strg+Enter) ist neben der normalen
  Zeilenumbruch-Eingabe (Enter) verfügbar, damit mehrzeilige Texte komfortabel
  eingegeben werden können, ohne versehentlich ein Submit auszulösen.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens
- [`ui-input`](ui-input.md) — Alternative für einzeilige Texteingabe

## Offene Punkte

- Auto-Resize (Textarea wächst mit dem Inhalt) ist noch nicht modelliert.
- Clientseitige Validierungsregeln (Required, Pattern) sind noch nicht modelliert.
