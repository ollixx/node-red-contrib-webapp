# `ui-select`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-select` rendert ein Dropdown- oder Combobox-Auswahlfeld. Die auswählbaren
Optionen werden entweder statisch als `{ label, value }`-Liste konfiguriert oder
dynamisch über ein Store-Binding bezogen. Der Knoten unterstützt Einzel- und
Mehrfachauswahl. Bei Auswahländerung emittiert er ein `change`-Event auf dem
Output-Port.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder vorgeben.
- **Rolle zur Laufzeit:** liest `value` und `options` aus dem Client-State; gibt
  `change`-Events auf dem Output-Port aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.
Binding-Kategorien (Value/display, Boolean-Zustand): [ADR 0012](../../adr/0012-binding-ubiquity-every-value-field-offers-bindings.md).

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Select N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | typedInput (voller Binding-Satz, P133) | **ja** | Beschriftung des Auswahlfeldes. Bindbar (ADR 0012, Value/display-Kategorie) — kanonischer Satz, siehe [stores.md](../concepts/stores.md#der-kanonische-value-binding-typ-satz-editor--adr-0012--adr-0010). Ein bestehender plain-string `label` wird automatisch als Literal-Binding übernommen. Pflicht: das Feld darf nicht leer sein. |
| `value` | „Value" | typedInput (voller Binding-Satz, P124) | **ja** | Bindbare **Lese**-Quelle des aktuell gewählten Werts (Anzeige-/Initialwert). Voller Binding-Satz (ADR 0012, Value/display-Kategorie, inkl. scope-lokaler Typen im passenden Scope) — siehe [stores.md](../concepts/stores.md#der-kanonische-value-binding-typ-satz-editor--adr-0012--adr-0010). Migration: ein bestehender `valuePath` wird automatisch als `state`-Binding übernommen. |
| `writeTo` | „Write To" | typedInput (**nur schreibbare** Arten: Store/Flow/Global, P204) | optional | Bindbares **Schreib**-Ziel (ADR 0027). Nur die schreibbaren Kinds: `store` (ein `ui-store` + optionaler ein-Ebenen-Sub-Pfad, per-client, live SSE-Re-Render), `flow`, `global` (server-seitig). Die Runtime schreibt die Auswahl beim Trigger hierhin zurück. Ein `ui-select` hat **keine Submit-Geste** → schreibt bei `change`, unabhängig vom `writeTrigger`. |
| `writeTrigger` | „Write Trigger" | SelectBox (`change` / `submit`) | optional | Default `submit`. Bei Nicht-Text-Kontrollen wie `ui-select` ohne Wirkung: es wird effektiv immer bei `change` geschrieben (nie „nie"). |
| `options` | „Options" | typedInput `{ json \| store }` (P133) | optional | **Ein** Feld mit zwei Typen. Typ `json` nutzt den NR-JSON-Editor und validiert die Struktur vor dem Deploy (Knoten rot bei Fehler) — genau eine von drei Formen: Objekt `{ "<label>": "<value>" }`, String-Array `["A","B"]` (Value = Label) oder Objekt-Array `[{ "label":…, "value":… }]`. Typ `store` liest die Optionen reaktiv aus einem Store(-Pfad). Migration: ein bestehender `optionsJson`-String öffnet im `json`-Typ; ein bestehender `optionsBinding` öffnet im `store`-Typ. Wenn leer, zeigt das Feld keine Optionen. |
| `placeholder` | „Placeholder" | typedInput (voller Binding-Satz, P133) | optional | Hinweistext, der angezeigt wird, wenn kein Wert ausgewählt ist. Bindbar (ADR 0012, Value/display-Kategorie); ein Store-/state-Binding zeigt den Live-Wert. |
| `multiple` | „Multiple" | Checkbox | optional | Erlaubt Mehrfachauswahl. Bei `true` ist `value` ein Array der gewählten Werte. Default: `false`. |
| `size` | „Größe" | SelectBox (`small` / `medium` / `large`) | optional | Größe des Auswahlfeldes. Default: `medium`. |
| `disabled` | „Disabled" | typedInput (Boolean-Zustand-Satz, P124) | optional | Bindbare Bedingung, die das Auswahlfeld deaktiviert (Nutzerinteraktion gesperrt). Boolean-Zustand-Satz (ADR 0012, ohne string/number/json/timestamp) — Details: [editor.md](../concepts/editor.md#bindbare-werte-die-typedinput-binding-typen-p67). Ein Store-Binding deaktiviert das Select live, sobald der Wert truthy ist. |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlfeld | optional | Reihenfolge im Parent-Slot (horizontal/vertical Layout). |
| `row` / `col` | „Row" / „Col" | Zahlfeld (≥ 1) | optional | Startposition im Grid-Layout (1-basiert). |
| `colSize` / `rowSize` | „Col Span" / „Row Span" | Zahlfeld (≥ 1) | optional | Spalten-/Zeilenspanne im Grid-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlfeld | optional | Pixelkoordinaten im Absolute-Layout. |

### Entfernte Felder (migriert, ADR 0027)

| Feld (alt) | Status | Migration |
|---|---|---|
| `storeId` | **entfernt** | Ein Alt-Knoten mit `storeId`+`path` wird beim Öffnen im Editor verlustfrei nach `writeTo = {kind:"store", path:<storeId>, subPath:{kind:"literal", value:<path>}}` migriert; beim Speichern werden die Alt-Felder nicht mehr erzeugt. Die Runtime führt dieselbe Migration für alt-deployte Configs durch. |
| `path` | **entfernt** | Siehe `storeId` — wird zum `subPath` des migrierten `writeTo`. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-select"`-Hilfetext soll knapp sein: Zweck
(Dropdown/Combobox), Hinweis auf statische vs. dynamische Optionen,
Mehrfachauswahl, `change`-Event und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-select.md`.

## Input

`ui-select` hat einen **Eingangs-Port**, über den der Flow den Auswahlwert und
den Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld des Knotens
  und sendet einen frischen Snapshot an alle verbundenen Clients der App.
  Bei Mehrfachauswahl muss `payload` ein Array sein.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition
  (z. B. `options`, `disabled`, `placeholder`). Binding-behaftete Felder
  (`value`, `options`) müssen als Binding-Objekt übergeben werden.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Interaktion freigeben / sperren
  - `reset` — Auswahl auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-select` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzer ändert die Auswahl | `value` — der neue Auswahlwert (bei Mehrfachauswahl: Array) | Auswahl verarbeiten, Store aktualisieren, Folgeanfragen starten |

Gemeinsame `msg.ui`-Felder: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `ui-store` (ausgewählte ID speichern, z. B. `selectedCustomerId`).
- `change` → `http request` → gefilterte Liste nachladen und in `ui-store` schreiben.
- `change` → `ui-action` (`navigate`) → Detailseite für den gewählten Datensatz öffnen.

## Theming

`ui-select` trägt kein eigenes `variant`-Feld — es erbt Theme-Tokens der
Parent-App. Das Theme wird von `ui-app` über Design-Tokens vorgegeben;
das Backend bildet sie auf die Dropdown-Darstellung ab. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **Optionen: ein Feld, zwei Typen (P133).** Die `options`-Konfiguration ist
  **ein** typedInput: Typ `json` (statisches, vor dem Deploy validiertes JSON in
  einer von drei Formen) oder Typ `store` (reaktiv aus einem Store-Pfad). Das
  Feld ist optional; leer rendert ein Auswahlfeld ohne Optionen.
- **Mehrfachauswahl.** Bei `multiple: true` ist `value` ein Array; das
  `change`-Event liefert entsprechend ein Array unter `msg.ui.params.value`.
- **Write-Back (P204 / ADR 0027).** `value` liest, `writeTo` schreibt. Ist ein
  `writeTo`-Ziel gesetzt, persistiert die Runtime die Auswahl **zusätzlich** zum
  `change`-Output-Event (additiv, keine Verdrahtung nötig): Store per-client mit
  `clientId` + SSE-Re-Render, Flow/Global server-seitig ohne Auto-Re-Render. Ein
  Select hat keine Submit-Geste → es schreibt immer bei `change`.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens
- [`ui-store`](../state/ui-store.md) — Optionen dynamisch aus dem Store; Ziel eines `writeTo=store`
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `value` liest, `writeTo` schreibt

## Offene Punkte

- Optionen-Gruppierung (Optgroup-Semantik) ist noch nicht modelliert.
- Clientseitige Pflichtfeld-Validierung ist noch nicht modelliert.
