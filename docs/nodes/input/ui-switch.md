# `ui-switch`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-switch` rendert einen Toggle-Switch für Boolean-Zustände. Im Unterschied zur
`ui-checkbox` ist der Switch visuell als Kippschalter gestaltet und trägt optionale
Beschriftungen für den An- und Aus-Zustand (`labelOn` / `labelOff`). Bei
Zustandswechsel emittiert der Knoten ein `change`-Event mit dem neuen `checked`-Wert
auf dem Output-Port.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder vorgeben.
- **Rolle zur Laufzeit:** liest `value` (Boolean) aus dem Client-State; schreibt
  den neuen Checked-Zustand bei Nutzerinteraktion zurück. Gibt `change`-Events
  auf dem Output-Port aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Switch N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `value` | „Value Path" | typedInput (alle Binding-Arten) | **ja** | Bindbare **Lese**-Quelle des Toggle-Zustands. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `writeTo` | „Write To" | typedInput (**nur schreibbare** Arten: Store/Flow/Global, P204) | optional | Bindbares **Schreib**-Ziel (ADR 0027). Nur `store`/`flow`/`global`. Die Runtime schreibt den Toggle-Zustand beim Trigger hierhin zurück (Store per-client + SSE-Re-Render; Flow/Global server-seitig). Ein Switch hat **keine Submit-Geste** → schreibt bei `change`, unabhängig vom `writeTrigger`. |
| `writeTrigger` | „Write Trigger" | SelectBox (`none` / `change` / `submit`) | optional | Default `submit`; bei einem Switch ohne Wirkung — es wird effektiv immer bei `change` geschrieben. Ausnahme `none` (P206): **kein** automatischer Write-Back (auch nicht bei `change`) — der `change`-Output feuert weiter, der Flow-Autor verdrahtet die Persistenz selbst; `writeTo` darf bei `none` leer sein. |
| `label` | „Label" | Textfeld | optional | Beschriftung neben dem Switch-Element (z. B. „Benachrichtigungen"). Wenn leer, wird kein Label angezeigt. |
| `labelOn` | „Label On" | Textfeld | optional | Text, der im Eingeschaltet-Zustand neben oder innerhalb des Switches angezeigt wird (z. B. „An"). |
| `labelOff` | „Label Off" | Textfeld | optional | Text, der im Ausgeschaltet-Zustand neben oder innerhalb des Switches angezeigt wird (z. B. „Aus"). |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die den Switch deaktiviert (Nutzerinteraktion gesperrt). |

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

Der `data-help-name="ui-switch"`-Hilfetext soll knapp sein: Zweck (Toggle-Switch,
Boolean-Binding), optionale An/Aus-Beschriftung, `change`-Event mit `checked`
und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-switch.md`.

## Input

`ui-switch` hat einen **Eingangs-Port**, über den der Flow den Toggle-Zustand und
den Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld (Boolean) des
  Knotens und sendet einen frischen Snapshot an alle verbundenen Clients der App.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition
  (z. B. `label`, `labelOn`, `labelOff`, `disabled`). Binding-behaftete Felder
  (`value`) müssen als Binding-Objekt übergeben werden.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Interaktion freigeben / sperren
  - `reset` — Toggle-Zustand auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-switch` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzer kippt den Switch | `checked` — der neue Boolean-Zustand (`true` = ein, `false` = aus) | Zustandswechsel verarbeiten, Store aktualisieren, Folgeverhalten auslösen |

Gemeinsame `msg.ui`-Felder: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `ui-store` (Boolean-Flag speichern, z. B. `darkMode`, `notificationsEnabled`).
- `change` → `http request` → serverseitige Einstellung persistieren.
- `change` → `ui-action` (`show`/`hide`) → bedingte Sichtbarkeit anderer Bereiche steuern.

## Theming

`ui-switch` trägt kein eigenes `variant`-Feld — es erbt Theme-Tokens der
Parent-App. Das Theme wird von `ui-app` über Design-Tokens vorgegeben;
das Backend bildet sie auf die Switch-Darstellung ab. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **Abgrenzung zu `ui-checkbox`.** `ui-switch` und `ui-checkbox` teilen dieselbe
  Boolean-Semantik. Der Switch ist visuell als Kippschalter gestaltet und
  eignet sich besonders für Einstellungen/Präferenzen; die Checkbox eignet sich
  für Bestätigungen (z. B. „AGB akzeptiert") und Listen-Auswahl.
- **`checked` im Event, nicht `value`.** Das `change`-Event trägt `params.checked`
  (nicht `params.value`), konsistent mit `ui-checkbox` und dem `checkboxChange`-Event
  der `ui-table`. Der Write-Back persistiert denselben `checked`-Boolean.
- **Write-Back (P204 / ADR 0027).** `value` liest, `writeTo` schreibt. Ist ein
  `writeTo`-Ziel gesetzt, persistiert die Runtime den Toggle-Zustand **zusätzlich**
  zum `change`-Event (additiv): Store per-client + SSE-Re-Render, Flow/Global
  server-seitig ohne Auto-Re-Render. Ohne Submit-Geste schreibt der Switch immer
  bei `change`.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten; Ziel eines `writeTo=store`
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens
- [`ui-checkbox`](ui-checkbox.md) — alternative Boolean-Eingabe
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `value` liest, `writeTo` schreibt

## Offene Punkte

- Farbkodierung des Switch im eingeschalteten Zustand (z. B. `success`-Token) ist noch nicht modelliert.
