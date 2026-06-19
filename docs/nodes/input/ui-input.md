# `ui-input`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-input` rendert ein einzeiliges Texteingabefeld und bindet seinen Wert
bidirektional an den Client-State. Drei Eingabe-Typen stehen zur Wahl
(`text`, `email`, `number`). Über das optionale Store-Binding schreibt der Knoten
Nutzeränderungen direkt in einen `ui-store` zurück; zusätzlich emittiert er bei
jeder Änderung und bei Bestätigung (Enter/Submit) ein Event auf seinem Output-Port.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder (`order`, `row`/`col`, `layoutX`/`layoutY`)
  vorgeben.
- **Rolle zur Laufzeit:** liest `value` aus dem Client-State; schreibt Änderungen
  bei Nutzerinteraktion in den State zurück (direkt oder via `ui-store`). Gibt
  `change`- und `submit`-Events auf dem Output-Port aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Input N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | Textfeld | **ja** | Beschriftung des Eingabefeldes. Wird als Feld-Label über dem Input angezeigt. |
| `value` | „Value Path" | typedInput (alle Binding-Arten) | **ja** | Bindbare Quelle des Feldwerts. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `inputType` | „Input Type" | SelectBox (`text` / `email` / `number`) | **ja** | Semantischer Eingabe-Typ. Steuert Tastatur-Typ und Browser-Validierung. Default: `text`. |
| `placeholder` | „Placeholder" | Textfeld | optional | Platzhaltertext, der angezeigt wird, wenn das Feld leer ist. |
| `variant` | „Variant" | SelectBox (Variant) | optional | Visuelle Feld-Rolle (`default`, `filled`, `outlined`). Default: `default`. Vocabulary: [theming.md](../concepts/theming.md). |
| `size` | „Größe" | SelectBox (`small` / `medium` / `large`) | optional | Größe des Eingabefeldes. Default: `medium`. |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die das Feld deaktiviert (Nutzereingabe gesperrt). |

### Gruppe „Store-Binding"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `storeId` | „Store ID" | Node-Picker-Dialog (Preset Stores) | optional | Referenz auf einen `ui-store`-Knoten. Wenn gesetzt, muss `path` ebenfalls gesetzt sein. |
| `path` | „Store Path" | Textfeld | optional (Pflicht wenn `storeId` gesetzt) | Relativer Pfad im Store-Slice, unter dem die Nutzeränderung gespeichert wird. Leer darf er nicht sein, wenn `storeId` gesetzt ist. |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlfeld | optional | Reihenfolge im Parent-Slot (horizontal/vertical Layout). |
| `row` / `col` | „Row" / „Col" | Zahlfeld (≥ 1) | optional | Startposition im Grid-Layout (1-basiert). |
| `colSize` / `rowSize` | „Col Span" / „Row Span" | Zahlfeld (≥ 1) | optional | Spalten-/Zeilenspanne im Grid-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlfeld | optional | Pixelkoordinaten im Absolute-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-input"`-Hilfetext soll knapp sein: Zweck (einzeiliges
Eingabefeld), Hinweis auf `value`-Binding und Store-Binding-Paar
(`storeId` + `path`), `change`- und `submit`-Events und ein Link auf die
ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-input.md`.

## Input

`ui-input` hat einen **Eingangs-Port**, über den der Flow den Feldwert und den
Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld des Knotens und
  sendet einen frischen Snapshot an alle verbundenen Clients der App. Nutzbar z. B.
  aus einem `inject`-Knoten heraus, um das Feld vorzubefüllen.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition (z. B.
  `placeholder`, `disabled`, `inputType`). Binding-behaftete Felder (`value`)
  müssen als Binding-Objekt übergeben werden. Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Eingabe freigeben / sperren
  - `focus` — Fokus auf das Feld setzen
  - `reset` — Feldwert auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-input` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzereingabe (jede Änderung des Feldwerts) | `value` — der neue Feldwert | Validierung, Live-Suche, Store-Update |
| `submit` | Enter / Submit-Auslösung | `value` — der bestätigte Feldwert | Formular absenden, Suchanfrage starten |

Gemeinsame `msg.ui`-Felder beider Events: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `function` → Validierung → `ui-store` (Entwurf speichern).
- `submit` → `http request` → API-Aufruf mit dem eingegebenen Wert.
- `submit` → `ui-action` (`navigate`) → Weiterleitung nach erfolgreichem Speichern.

## Theming

`ui-input` trägt ein echtes Ebene-2-`variant`-Feld (`default`, `filled`,
`outlined`) — ausgewählt über die Variant-SelectBox, gespeist aus
`INPUT_VARIANTS` (`packages/schema/src/contracts.ts`). Das Renderer-Backend
bildet die Variante auf die entsprechende visuelle Darstellung ab; unbekannte
Varianten werden auf `default` zurückgefallen. Details: [theming.md](../concepts/theming.md).

## Besonderheiten

- **Store-Binding-Paar.** `storeId` und `path` müssen immer gemeinsam gesetzt oder
  gemeinsam leer gelassen werden. Das Schema (`uiInputNodeDefinitionSchema`)
  erzwingt diese Invariante: ein partiell gesetztes Paar ist ein Fehler.
- **Direkte vs. Store-gestützte Rückschreibung.** Ohne Store-Binding schreibt
  Nutzerinteraktion via Events in den Flow; mit Store-Binding schreibt der Renderer
  die Änderung direkt in den Store.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten und Store-Operationen
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Variant-Vokabular
- [`ui-store`](../state/ui-store.md) — Store-Knoten
- [`ui-container`](../display/ui-container.md) — möglicher Parent

## Offene Punkte

- Clientseitige Validierungsregeln (Required, Pattern, Min/Max für number) sind noch nicht modelliert.
- Das Zusammenspiel von direktem State-Binding und Store-gestützter Rückschreibung bei gleichzeitigem Einsatz beider Mechanismen ist noch nicht vollständig spezifiziert.
