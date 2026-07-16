# `ui-button`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-button` rendert einen **klickbaren Button**. Jeder Klick des Nutzers erzeugt
ein `click`-Event auf dem Output-Port des Knotens. Der Flow-Autor verdrahtet
diesen Port mit beliebigen Folgeknoten — z. B. einem `ui-action` (Navigation),
einem `function`-Knoten (Validierung) oder einem `ui-store` (Zustandsänderung).
Der Button hat keine eigene Logik; er ist ausschließlich Ereignis-Quelle.

## Einordnung

- **Parent:** `ui-app`, `ui-route`, `ui-dialog` oder `ui-container` — genau
  einer; gemountet über `mount` in einen Slot des Parents.
- **Kinder:** keine — `ui-button` ist ein Blatt-Knoten.
- **Rolle zur Laufzeit:** der Renderer stellt den Button dar; Klicks werden als
  Event an den Node-RED-Flow gemeldet.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt (Node-Picker-Dialog,
typedInput, Variant-SelectBox, Mount-Baum, Layout-Child-Props).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Button N`. |
| `mount` | „Parent Slot" | Mount-Baum (Node-Picker-Dialog) | **ja** | Slot-Pfad des Parents (`<type>:<id>/<slot>`). Bestimmt die sichtbaren Layout-Child-Props (Gruppe „Platzierung"). |

#### Basis-Felder (ADR 0015 — gemeinsame Feld-Gruppe)

`ui-button` rendert die gemeinsame Basis-Feld-Gruppe über `installBaseFields(config)`
(siehe [editor.md](../concepts/editor.md), Abschnitt „Basis-Felder + Editor-Struktur").
Anwendbarkeit für den Button: `visible` + `variant` aktiv; `disabled` und `size`
haben eigene dedizierte Controls (deshalb `omit`, siehe Gruppen „Inhalt" /
„Darstellung"); `color` ist **nicht** anwendbar (die Button-Farbe wird über
`variant` ausgedrückt — „variant = Farbe"-Konvention).

| Feld | Label | Editor-Typ | Anwendbar | Beschreibung |
|---|---|---|---|---|
| `visible` | „Visible" | Boolean-Zustand-typedInput (ADR-0012-Boolean-Satz) | ja | Sichtbarkeit; leer = sichtbar (Default). Persistiert als Binding-Objekt und wird zur Laufzeit als `visibleIf` ausgewertet (Render-Gate): `false` ⇒ der Button wird nicht gerendert. Dynamisches Zustandsmodell: [ADR 0037](../../adr/0037-unified-dynamic-state-fields-one-value-many-writers.md). |
| `disabled` | „Deaktiviert" | dediziertes typedInput (Boolean-Satz) | ja | Interaktiver Zustand — über das eigene Control in Gruppe „Inhalt" (deshalb aus der Basis-Gruppe `omit`). Siehe dort. |
| `color` | „Color" | — (N/A) | **nein** | Die Button-Farbe wird über `variant` (semantische Rolle) gesetzt, nicht über ein allgemeines `color`-Feld — daher ist `color` für den Button nicht aktiv. |
| `size` | „Size" | dedizierte Size-SelectBox | ja | Dreistufige Größe — über das eigene Control in Gruppe „Darstellung" (deshalb aus der Basis-Gruppe `omit`). Siehe dort. |
| `variant` | „Variante" | Variant-SelectBox (`BUTTON_VARIANTS`) | ja | Semantische Rolle **und Farbe** des Buttons — siehe Gruppe „Darstellung". |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | Wert-typedInput (voller Binding-Satz, ADR 0012) | **ja** | Beschriftung des Buttons. **Volles Wert-Binding** (nicht bloß ein statischer String): ein Literal (`{ kind: "literal", value: … }`) ODER ein dynamisches Binding (Store / Query / Route-Param / Reactive / msg / JSONata / Flow / Global / Env). Der typedInput lebt direkt auf `#node-input-label`; ein Legacy-Plain-String wird beim Öffnen als `literal` migriert. Validierung über `validateValueBindingField`. Als Literal darf das Label nicht leer sein. |
| `icon` | „Icon" | Textfeld + Icon-Picker (P69) | optional | Backend-neutraler Icon-Wert `{ library, name }` (bzw. `library:name`, Default-Library bei nacktem Namen), gerendert im Prefix-Slot des Buttons. Bindbar (literal via Picker ODER dynamisch). Details: [ui-icon.md](./ui-icon.md). |
| `disabled` | „Deaktiviert" | typedInput (alle Binding-Arten) | optional | Bindbare boolesche Bedingung. Ist der aufgelöste Wert `true`, ist der Button deaktiviert und emittiert keine Click-Events. |

### Gruppe „Darstellung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `variant` | „Variante" | Variant-SelectBox (`BUTTON_VARIANTS`) | optional | Semantische Rolle des Buttons: `primary`, `secondary`, `success`, `danger`, `warning`, `neutral`, `ghost`, `link`. Default: `neutral`. Das Rendering-Backend bildet die Variante auf die passende visuelle Darstellung ab (Farbe, Kontur, Stil). Details: [theming.md](../concepts/theming.md). |
| `size` | „Size" | Size-SelectBox (`sm`/`md`/`lg`) | optional | Dreistufige Größe. Leer = Standardgröße des Backends. Das Backend (heute Shoelace) bildet `sm`/`md`/`lg` auf `small`/`medium`/`large` ab. |
| `outline` | „Outline" | Checkbox | optional | Zeichnet den Button mit Kontur statt Füllung. Unabhängig von der `variant`-abgeleiteten Darstellung (kein Doppel-Apply). |

### Gruppe „Link-Modus"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `linkMode` | „Link Mode" | SelectBox (`button`/`url`/`navigate`) | optional | `button` (Default) = Ereignis-Quelle (Click-Event auf Output-Port); `url` = echter Hyperlink (rendert ein `<a>` via Backend-`href`); `navigate` = clientseitige In-App-Navigation zur Route in `href`, der Klick wird zusätzlich an den Flow gemeldet. |
| `href` | „URL / Route" | typedInput (bindbar) | optional | Ziel für `url`/`navigate`. Bindbar (literal ODER dynamisch). Wird im Editor nur in den Modi `url`/`navigate` eingeblendet. |

### Gruppe „Platzierung"

Die Felder dieser Gruppe werden vom Editor **abhängig vom gewählten Mount** eingeblendet:

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Reihenfolge" | Zahlenfeld | optional | Position innerhalb von `horizontal`- und `vertical`-Layouts. Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` | „Zeile" / „Spalte" | Zahlenfeld (min 1) | optional | Grid-Position (1-basiert). Nur sichtbar bei `grid`-Layout. |
| `colSize` / `rowSize` | „Spaltenbreite" / „Zeilenhöhe" | Zahlenfeld (min 1) | optional | Grid-Spannweite. Nur sichtbar bei `grid`-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlenfeld | optional | Absolute Koordinaten. Nur sichtbar bei `absolute`-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-button"`-Hilfetext soll **knapp, aber ausreichend** sein:
Zweck (klickbarer Button, Click-Event auf Output-Port), Hinweis auf `variant` und
`disabled`-Binding, Hinweis auf das Wiring-Muster (`ui-action`) und ein Link auf
die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/display/ui-button.md`.

## Input

`ui-button` hat einen **Eingangs-Port**, der folgende Messages akzeptiert:

- **`msg.payload`** (nicht-null): überschreibt das `label`-Feld sofort und pusht
  einen aktualisierten Snapshot an alle verbundenen Clients.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** (`show` / `hide` / `enable` / `disable`): blendet
  den Button ein/aus oder schaltet ihn aktiv/inaktiv, ohne das Binding zu verändern.
- **`msg.ui.patch`**: überschreibt beliebige Felder der Knoten-Definition.
- **Nicht erkannte / fachfremde Messages:** werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-button` hat **einen Output-Port**. Sobald der Nutzer den Button klickt (und
der Button nicht deaktiviert ist), emittiert der Knoten:

| Event | Wann | Erzeugte `msg.ui`-Felder | Intention |
|---|---|---|---|
| `click` | Nutzer klickt den Button | `event: "click"`, `sourceId`, `appId`, `clientId` | den Flow über die Nutzeraktion informieren; Folgeknoten entscheiden über die Reaktion |

`msg.ui.params` ist bei `click` leer — der Button transportiert keine
event-eigenen Nutzlast-Daten. Weitere Daten (z. B. den aktuellen Formularstand)
liefert der Flow-Autor über verdrahtete `ui-store`- oder `ui-query`-Knoten.

**Antizipierte Wiring-Szenarien:**

- `click` → `ui-action` (Navigate zu einer Route).
- `click` → `function` → HTTP-Request → `ui-store` (Daten speichern).
- `click` → `ui-action` (Dialog öffnen).

## Theming

`ui-button` trägt eine echte **Ebene-2-Variante** (`variant`). Die Variante
beschreibt die semantische Rolle des Buttons; das Rendering-Backend (heute
Shoelace) bildet sie auf seine Web-Component-Props ab. Das App-weite Theme
(Design-Tokens am `ui-app`-Knoten) bestimmt, wie `primary`, `danger` usw.
konkret aussehen. Weitere Backends folgen demselben semantischen Contract ohne
Änderung am Knoten-Modell. Details: [theming.md](../concepts/theming.md).

## Besonderheiten

- **`action`-Feld (deprecated).** In früheren Versionen referenzierte der Button
  eine Action-ID direkt über das `action`-Feld. Dieses Feld wird vom Schema noch
  akzeptiert (Abwärtskompatibilität mit bestehenden Flows), gilt aber als
  veraltet. Neue Flows verdrahten stattdessen den Output-Port mit dem
  gewünschten `ui-action`-Knoten.

## Referenzen

- [layout.md](../concepts/layout.md) — Presets und Child-Platzierungs-Felder
- [theming.md](../concepts/theming.md) — Variant-Vokabular (`BUTTON_VARIANTS`) und Backends
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [inputs.md](../concepts/inputs.md) — `msg.payload` / `msg.ui.patch` / Component-Ops
- [editor.md](../concepts/editor.md) — Editor-Typen (Variant-SelectBox, Mount-Baum)
- [`ui-action`](../behavior/ui-action.md) — typische Folgeknoten nach einem Click

## Offene Punkte

- **Größe (`size`), Outline-Flag (`outline`) und Link-Modus (`linkMode` + `href`)**
  sind seit P71 als commitierte Schema-Felder modelliert (siehe Gruppen
  „Darstellung" und „Link-Modus" oben).
- **Icon-Integration** ist seit P69 umgesetzt (Feld `icon`, Prefix-Slot,
  Backend-neutral `{ library, name }`, bindbar — siehe oben).
- **Beliebige Kind-Knoten in Button-Slots (prefix/suffix).** Heute belegt nur das
  `icon`-Feld den Prefix-Slot. Das Mounten *beliebiger* Knoten in `prefix`/`suffix`
  (Button als Mini-Container) bleibt offen — es erfordert, den Button zum
  Layout-Host mit eigenen Slots zu machen (feste Slots vs. Layout-Preset). P71 hat
  diesen Entwurfspunkt bewusst zurückgestellt; der gängige Fall (Icon vor dem
  Label) ist abgedeckt.
