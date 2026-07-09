# `ui-radio`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-radio` rendert eine Radio-Gruppe, in der genau eine Option gewählt werden
kann. Die Optionen werden entweder statisch als `{ label, value }`-Liste
konfiguriert oder dynamisch über ein Binding bezogen. Die Ausrichtung der
Gruppe (horizontal/vertikal) ist konfigurierbar. Bei Auswahländerung emittiert
der Knoten ein `change`-Event auf dem Output-Port.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder vorgeben.
- **Rolle zur Laufzeit:** liest `value` (die gewählte Option) und `options` aus
  dem Client-State; gibt `change`-Events auf dem Output-Port aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Radio N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | typedInput (kanonischer Wert-Satz) | **ja** | Gruppen-Beschriftung der Radio-Gruppe. P136 (ADR 0012): literaler Text **oder** ein Binding (`store`, `query`, `routeParam`, `state`/Reactive, `msg`, `jsonata`, `flow`, `global`, `env`) — derselbe Satz wie `ui-select`. Ein Store-/State-Binding zeigt den Live-Wert. |
| `value` | „Value" | typedInput (alle Binding-Arten) | **ja** | Bindbare **Lese**-Quelle des aktuell gewählten Werts. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `writeTo` | „Write To" | typedInput (**nur schreibbare** Arten: Store/Flow/Global, P204) | optional | Bindbares **Schreib**-Ziel (ADR 0027). Nur `store`/`flow`/`global`. Die Runtime schreibt den gewählten Wert beim Trigger hierhin zurück (Store per-client + SSE-Re-Render; Flow/Global server-seitig). Eine Radiogruppe hat **keine Submit-Geste** → schreibt bei `change`, unabhängig vom `writeTrigger`. |
| `writeTrigger` | „Write Trigger" | SelectBox (`none` / `change` / `submit`) | optional | Default `submit`; bei einer Radiogruppe ohne Wirkung — es wird effektiv immer bei `change` geschrieben. Ausnahme `none` (P206): **kein** automatischer Write-Back (auch nicht bei `change`) — der `change`-Output feuert weiter, der Flow-Autor verdrahtet die Persistenz selbst; `writeTo` darf bei `none` leer sein. |
| `options` | „Options" | **ein** typedInput `{ json \| store }` | optional | P136 (ADR 0012): **ein** Feld mit dem **geteilten Options-Helfer** (eine Quelle für `ui-select` **und** `ui-radio`). Typ `json` öffnet den NR-JSON-Editor und validiert genau eine von drei Formen — Objekt `{ "<label>": "<value>" }`, String-Array `["A","B"]` oder Objekt-Array `[{ label, value }]`; andere Strukturen markieren den Knoten vor Deploy als ungültig (sprechende Meldung). Typ `store` liest die Optionen reaktiv aus einem Store(-Pfad) (P134-Layout). Es gibt **kein** separates `optionsBinding`-Feld mehr. Legacy `optionsJson`/`optionsBinding` migrieren verlustfrei. |
| `orientation` | „Orientation" | SelectBox (`vertical` / `horizontal`) | optional | Ausrichtung der Radio-Gruppe. `vertical` = Optionen untereinander; `horizontal` = nebeneinander. Default: `vertical`. |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die die gesamte Radio-Gruppe deaktiviert (Nutzerinteraktion gesperrt). |

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

Der `data-help-name="ui-radio"`-Hilfetext soll knapp sein: Zweck (Radio-Gruppe,
Einzel-Auswahl), Hinweis auf statische vs. dynamische Optionen, Orientierung,
`change`-Event und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-radio.md`.

## Input

`ui-radio` hat einen **Eingangs-Port**, über den der Flow die gewählte Option und
den Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld des Knotens
  (den Wert der vorgewählten Option) und sendet einen frischen Snapshot an alle
  verbundenen Clients der App.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition
  (z. B. `options`, `disabled`, `orientation`). Binding-behaftete Felder
  (`value`, `options`) müssen als Binding-Objekt übergeben werden.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Interaktion freigeben / sperren
  - `reset` — Auswahl auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-radio` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzer wählt eine andere Option | `value` — der Wert der neu gewählten Option | Auswahl verarbeiten, Store aktualisieren, bedingte Felder steuern |

Gemeinsame `msg.ui`-Felder: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `ui-store` (Auswahl speichern, z. B. `selectedRole`).
- `change` → `function` → bedingte Sichtbarkeit anderer Felder via `ui-action` (`show`/`hide`).
- `change` → `http request` → kontextabhängige Optionen nachladen.

## Theming

`ui-radio` trägt kein eigenes `variant`-Feld — es erbt Theme-Tokens der
Parent-App. Das Theme wird von `ui-app` über Design-Tokens vorgegeben;
das Backend bildet sie auf die Radio-Darstellung ab. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **Genau-Eins-Semantik.** Es ist stets genau eine Option ausgewählt (oder keine,
  wenn `value` keiner Option entspricht). Mehrfachauswahl ist nicht vorgesehen —
  dafür steht `ui-checkbox` oder `ui-select` mit `multiple: true` zur Verfügung.
- **Geteilter Options-Helfer (P136).** `ui-radio` und `ui-select` sind die
  einzigen zwei Knoten mit einem Options-Modell und teilen sich **eine** Quelle:
  den Helfer in `resources/lib/editor-common.js`
  (`installOptionsField` / `validateOptionsJson` / `normalizeOptionsStructure`)
  und den Validator `normalizeSelectOptions` im Schema. Eine Änderung an der
  Options-Logik ist genau eine Stelle. `ui-radio` hat — anders als `ui-select` —
  **kein** `placeholder`/`searchable` (das bleibt `ui-select`-spezifisch).
- **Optionen: optional.** Schema:
  `z.union([z.array(selectOptionSchema), bindingSchema]).optional()` — ein
  noch-nicht-konfigurierter Radio (leere/`null`-Optionen) bleibt gültig
  (gespiegelt von `ui-select`).
- **Write-Back (P204 / ADR 0027).** `value` liest, `writeTo` schreibt. Ist ein
  `writeTo`-Ziel gesetzt, persistiert die Runtime den gewählten Wert **zusätzlich**
  zum `change`-Event (additiv): Store per-client + SSE-Re-Render, Flow/Global
  server-seitig. Ohne Submit-Geste schreibt die Radiogruppe immer bei `change`.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten; Ziel eines `writeTo=store`
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens
- [`ui-select`](ui-select.md) — Alternative für Mehrfachauswahl oder lange Optionslisten
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `value` liest, `writeTo` schreibt

## Offene Punkte

- Einzelne Optionen innerhalb der Gruppe deaktivieren ist noch nicht modelliert.
