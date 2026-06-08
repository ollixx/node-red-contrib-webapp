# `ui-checkbox`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-checkbox` rendert eine einzelne Checkbox und bindet ihren Boolean-Zustand
(`true` = angehakt, `false` = nicht angehakt) bidirektional an den Client-State.
Bei Zustandswechsel emittiert der Knoten ein `change`-Event mit dem neuen
`checked`-Wert auf dem Output-Port.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder vorgeben.
- **Rolle zur Laufzeit:** liest `value` (Boolean) aus dem Client-State; schreibt
  den neuen Checked-Zustand bei Nutzerinteraktion zurück. Gibt `change`-Events auf
  dem Output-Port aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Checkbox N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | Textfeld | **ja** | Beschriftung der Checkbox. Wird neben dem Häkchen-Element angezeigt. |
| `value` | „Value Path" | typedInput (alle Binding-Arten) | **ja** | Bindbare Boolean-Quelle des Checked-Zustands. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die die Checkbox deaktiviert (Nutzerinteraktion gesperrt). |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlfeld | optional | Reihenfolge im Parent-Slot (horizontal/vertical Layout). |
| `row` / `col` | „Row" / „Col" | Zahlfeld (≥ 1) | optional | Startposition im Grid-Layout (1-basiert). |
| `colSize` / `rowSize` | „Col Span" / „Row Span" | Zahlfeld (≥ 1) | optional | Spalten-/Zeilenspanne im Grid-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlfeld | optional | Pixelkoordinaten im Absolute-Layout. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-checkbox"`-Hilfetext soll knapp sein: Zweck (einzelne
Checkbox, Boolean-Binding), Hinweis auf `change`-Event und ein Link auf die
ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-checkbox.md`.

## Input

`ui-checkbox` hat einen **Eingangs-Port**, über den der Flow den Checked-Zustand
und den Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld (Boolean) des
  Knotens und sendet einen frischen Snapshot an alle verbundenen Clients der App.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition
  (z. B. `disabled`). Binding-behaftete Felder (`value`) müssen als
  Binding-Objekt übergeben werden. Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Interaktion freigeben / sperren
  - `reset` — Checked-Zustand auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-checkbox` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzer hakt die Checkbox an oder ab | `checked` — der neue Boolean-Zustand (`true` / `false`) | Zustandswechsel verarbeiten, Store aktualisieren, bedingte Logik auslösen |

Gemeinsame `msg.ui`-Felder: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `ui-store` (Boolean-Flag setzen, z. B. „Nutzungsbedingungen akzeptiert").
- `change` → `function` → bedingte Aktivierung anderer Felder via `ui-action` (`enable`/`disable`).
- `change` → `http request` → serverseitige Preference speichern.

## Theming

`ui-checkbox` trägt kein eigenes `variant`-Feld — es erbt Theme-Tokens der
Parent-App. Das Theme wird von `ui-app` über Design-Tokens vorgegeben;
das Backend bildet sie auf die Checkbox-Darstellung ab. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **Boolean-Semantik.** Der `value`-Binding-Wert wird als Boolean interpretiert:
  jeder Truthy-Wert zeigt die Checkbox als angehakt, Falsy als nicht angehakt.
- **Kein Indeterminate-Zustand.** Der Knoten modelliert einen Zwei-Zustands-Schalter;
  ein partieller (indeterminate) Zustand ist nicht Teil dieses Knotens.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens

## Offene Punkte

- Indeterminate-Zustand (z. B. für „Alle auswählen"-Szenarien) ist noch nicht modelliert.
- Gruppe mehrerer Checkboxen mit gemeinsamem Label (Fieldset-Semantik) ist noch nicht vorgesehen.
