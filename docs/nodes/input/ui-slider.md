# `ui-slider`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-slider` rendert einen horizontalen Schieberegler für numerische Werte.
Minimum, Maximum und Schrittweite sind konfigurierbar; optional wird der
aktuelle Wert neben dem Regler angezeigt. Bei Wertänderung emittiert der Knoten
ein `change`-Event auf dem Output-Port.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `app` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`app`
  und die Layout-Child-Felder vorgeben.
- **Rolle zur Laufzeit:** liest `value` (Zahl) aus dem Client-State; gibt
  `change`-Events auf dem Output-Port aus, sobald der Nutzer den Regler bewegt.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Slider N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `value` | „Value Path" | typedInput (alle Binding-Arten) | **ja** | Bindbare **Lese**-Quelle des Slider-Werts (numerisch). Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `writeTo` | „Write To" | typedInput (**nur schreibbare** Arten: Store/Flow/Global, P204) | optional | Bindbares **Schreib**-Ziel (ADR 0027). Nur `store`/`flow`/`global`. Die Runtime schreibt den Slider-Wert beim Trigger hierhin zurück (Store per-client + SSE-Re-Render; Flow/Global server-seitig). Ein Slider hat **keine Submit-Geste** → schreibt bei `change`, unabhängig vom `writeTrigger`. Der Wert wird als numerischer String übergeben (**Sondermodell**: kein Textwert). |
| `writeTrigger` | „Write Trigger" | SelectBox (`none` / `change` / `submit`) | optional | Default `submit`; bei einem Slider ohne Wirkung — es wird effektiv immer bei `change` (Ziehen) geschrieben. Ausnahme `none` (P206): **kein** automatischer Write-Back (auch nicht bei `change`) — der `change`-Output feuert weiter, der Flow-Autor verdrahtet die Persistenz selbst; `writeTo` darf bei `none` leer sein. |
| `label` | „Label" | typedInput (alle Binding-Arten) | optional | Beschriftung des Schiebereglers. Wird als Feld-Label angezeigt. Wenn leer, wird kein Label angezeigt. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. |
| `min` | „Min" | Zahlfeld | optional | Minimaler Wert des Schiebereglers. Wenn nicht gesetzt, verwendet das Backend seinen Standard-Default. |
| `max` | „Max" | Zahlfeld | optional | Maximaler Wert des Schiebereglers. Wenn nicht gesetzt, verwendet das Backend seinen Standard-Default. |
| `step` | „Step" | Zahlfeld (> 0) | optional | Schrittweite, in der der Regler bewegt werden kann. Muss positiv sein. Wenn nicht gesetzt, verwendet das Backend seinen Standard-Default. |
| `showValue` | „Show Value" | Checkbox | optional | Zeigt den aktuellen Zahlenwert neben dem Regler an. Default: `false`. |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die den Slider deaktiviert (Nutzerinteraktion gesperrt). |

### Gruppe „Platzierung"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `order` | „Order" | Zahlfeld | optional | Reihenfolge im Parent-Slot (horizontal/vertical Layout). Default bei leerem Feld: Canvas-y (siehe layout.md). |
| `row` / `col` | „Row" / „Col" | Zahlfeld (≥ 1) | optional | Startposition im Grid-Layout (1-basiert). |
| `colSize` / `rowSize` | „Col Span" / „Row Span" | Zahlfeld (≥ 1) | optional | Spalten-/Zeilenspanne im Grid-Layout. |
| `layoutX` / `layoutY` | „X" / „Y" | Zahlfeld | optional | Pixelkoordinaten im Absolute-Layout. |

### Entfernte Felder (migriert, ADR 0027)

| Feld (alt) | Status | Migration |
|---|---|---|
| `storeId` | **entfernt** | Ein Alt-Knoten mit `storeId`+`path` wird beim Öffnen im Editor verlustfrei nach `writeTo = {kind:"store", path:<storeId>, subPath:{kind:"literal", value:<path>}}` migriert; beim Speichern werden die Alt-Felder nicht mehr erzeugt. Die Runtime führt dieselbe Migration für alt-deployte Configs durch. |
| `path` | **entfernt** | Siehe `storeId` — wird zum `subPath` des migrierten `writeTo`. |

### Inline-Hilfe (HTML)

Der `data-help-name="ui-slider"`-Hilfetext soll knapp sein: Zweck (numerischer
Schieberegler), Hinweis auf `min`/`max`/`step`, `showValue` und `change`-Event
und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-slider.md`.

## Input

`ui-slider` hat einen **Eingangs-Port**, über den der Flow den Slider-Wert und
den Komponentenzustand steuert.

- **`msg.payload`** (nicht-null) → aktualisiert das `value`-Feld (Zahl) des
  Knotens und sendet einen frischen Snapshot an alle verbundenen Clients der App.
  Der Wert wird auf den konfigurierten `min`/`max`-Bereich geclippt.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition
  (z. B. `min`, `max`, `step`, `disabled`). Binding-behaftete Felder (`value`,
  `disabled`) müssen als Binding-Objekt übergeben werden.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Interaktion freigeben / sperren
  - `reset` — Slider auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-slider` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzer bewegt den Schieberegler | `value` — der neue numerische Wert | Wert verarbeiten, Store aktualisieren, Echtzeit-Vorschau steuern |

Gemeinsame `msg.ui`-Felder: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `ui-store` (numerischen Wert speichern, z. B. Lautstärke, Helligkeit).
- `change` → `function` → abgeleitete Berechnung → `ui-text` aktualisieren.
- `change` → `http request` → Schwellenwert serverseitig anwenden.

## Theming

`ui-slider` trägt kein eigenes `variant`-Feld — es erbt Theme-Tokens der
Parent-App. Das Theme wird von `ui-app` über Design-Tokens vorgegeben;
das Backend bildet sie auf die Schieberegler-Darstellung ab. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **Schrittweiten-Constraint.** `step` muss positiv sein (Schema: `z.number().positive()`).
  Eine Schrittweite von 0 ist verboten; Dezimalwerte (z. B. `0.1`, `0.5`) sind
  zulässig für Fließkomma-Bereiche.
- **Event-Frequenz.** Der Slider emittiert `change`-Events kontinuierlich während
  des Ziehens. Flussdämpfung (Debounce/Throttle) ist Aufgabe des verdrahteten
  Flows, nicht des Knotens.
- **Write-Back (P204 / ADR 0027).** `value` liest, `writeTo` schreibt. Ist ein
  `writeTo`-Ziel gesetzt, persistiert die Runtime den Slider-Wert **zusätzlich**
  zum `change`-Event (additiv): Store per-client + SSE-Re-Render, Flow/Global
  server-seitig. Ohne Submit-Geste schreibt der Slider immer bei `change`. Der
  geschriebene Wert ist ein numerischer String (Sondermodell — der Slider hat
  keinen Textwert).

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten; Ziel eines `writeTo=store`
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `value` liest, `writeTo` schreibt

## Offene Punkte

- Bereich-Slider (Range Slider mit zwei Griffen) ist noch nicht modelliert.
- Tick-Marks / Beschriftungen entlang der Slider-Achse sind noch nicht modelliert.
- Debounce-Konfiguration auf Knotenebene ist noch nicht vorgesehen.
