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
| `label` | „Label" | Textfeld | **ja** | Gruppen-Beschriftung der Radio-Gruppe. Wird als übergeordnetes Label angezeigt. |
| `value` | „Value Path" | typedInput (alle Binding-Arten) | **ja** | Bindbare Quelle des aktuell gewählten Werts. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `options` | „Options (JSON)" / „Options Binding" | Textfeld (JSON) **oder** typedInput (Binding) | **ja** | Liste der Radio-Optionen. Entweder statisch als JSON-Array von `{ label, value }`-Objekten oder als Binding auf ein Array im Client-State. Mindestens eine Option ist erforderlich. |
| `orientation` | „Orientation" | SelectBox (`vertical` / `horizontal`) | optional | Ausrichtung der Radio-Gruppe. `vertical` = Optionen untereinander; `horizontal` = nebeneinander. Default: `vertical`. |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die die gesamte Radio-Gruppe deaktiviert (Nutzerinteraktion gesperrt). |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlfeld | optional | Reihenfolge im Parent-Slot (horizontal/vertical Layout). |
| `row` / `col` | „Row" / „Col" | Zahlfeld (≥ 1) | optional | Startposition im Grid-Layout (1-basiert). |
| `colSize` / `rowSize` | „Col Span" / „Row Span" | Zahlfeld (≥ 1) | optional | Spalten-/Zeilenspanne im Grid-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlfeld | optional | Pixelkoordinaten im Absolute-Layout. |

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
- **Optionen: Pflicht.** Im Gegensatz zu `ui-select` ist `options` bei `ui-radio`
  ein Pflichtfeld (Schema: `z.union([z.array(selectOptionSchema), bindingSchema])`
  ohne `.optional()`).

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens
- [`ui-select`](ui-select.md) — Alternative für Mehrfachauswahl oder lange Optionslisten

## Offene Punkte

- Einzelne Optionen innerhalb der Gruppe deaktivieren ist noch nicht modelliert.
