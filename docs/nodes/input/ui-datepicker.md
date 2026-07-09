# `ui-datepicker`

> **Anforderungs-Dokument.** Es beschreibt das *gewünschte* Verhalten des Knotens
> (den Vertrag), nicht den jeweils aktuellen Implementierungsstand. Abweichungen
> der Implementierung gehören **nicht** hierher — sie werden im Code/Test
> aufgedeckt und behoben.

## Zweck

`ui-datepicker` rendert ein Datums- und/oder Uhrzeit-Eingabefeld. Drei Modi
stehen zur Wahl: `date` (nur Datum), `datetime` (Datum und Uhrzeit) und `time`
(nur Uhrzeit). Optional können ein frühestes und ein spätestes erlaubtes Datum
(`min`/`max`) konfiguriert werden. Bei Auswahl emittiert der Knoten ein
`change`-Event mit dem neuen Wert als ISO-8601-String auf dem Output-Port.

## Einordnung

- **Parent:** ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder
  `ui-container` — angegeben über `mount` (Mount-Pfad) oder `parent` (Node-ID).
- **Kinder:** keine.
- **Erreichbarkeit:** im gerenderten Layout an der Position, die `mount`/`parent`
  und die Layout-Child-Felder vorgeben.
- **Rolle zur Laufzeit:** liest `value` (ISO-8601-String) aus dem Client-State;
  gibt `change`-Events auf dem Output-Port aus.

## Felder

Editor-Typen sind in [editor.md](../concepts/editor.md) erklärt.

### Gruppe „Allgemein"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor und in Auswahllisten. Default: fortlaufend `Datepicker N`. |
| `mount` | „Parent Slot" | Mount-Picker (Baum) | **ja** | Hierarchischer Slot-Picker (Route/Dialog → Container → Slot). Bestimmt den Einbauort im Layout. Siehe [layout.md](../concepts/layout.md). |

### Gruppe „Inhalt"

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `label` | „Label" | typedInput (alle Binding-Arten) | **ja** | Beschriftung des Datumseingabefeldes. Wird als Feld-Label über dem Datepicker angezeigt. Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. |
| `value` | „Value Path" | typedInput (alle Binding-Arten) | **ja** | Bindbare **Lese**-Quelle des Datumswerts als ISO-8601-String (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` oder `HH:mm` je nach Modus). Unterstützt alle Binding-Arten: `literal`, `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env`. Details: [stores.md](../concepts/stores.md). |
| `writeTo` | „Write To" | typedInput (**nur schreibbare** Arten: Store/Flow/Global, P204) | optional | Bindbares **Schreib**-Ziel (ADR 0027). Nur `store`/`flow`/`global`. Der Datepicker rendert ein `sl-input` (**text-artig**) und honoriert den `writeTrigger`: `submit` schreibt bei Enter/Blur, `change` bei jeder Auswahl. Store per-client + SSE-Re-Render; Flow/Global server-seitig. |
| `writeTrigger` | „Write Trigger" | SelectBox (`change` / `submit`) | optional | Default `submit` (= Enter/Blur). `change` schreibt bei jeder Auswahl. |
| `mode` | „Mode" | SelectBox (`date` / `datetime` / `time`) | optional | Eingabe-Modus. `date` = nur Datum; `datetime` = Datum und Uhrzeit; `time` = nur Uhrzeit. Default: `date`. |
| `min` | „Min" | Textfeld (`YYYY-MM-DD`) | optional | Frühestes erlaubtes Datum. Tage vor diesem Datum werden im Kalender deaktiviert und können nicht gewählt werden. |
| `max` | „Max" | Textfeld (`YYYY-MM-DD`) | optional | Spätestes erlaubtes Datum. Tage nach diesem Datum werden im Kalender deaktiviert und können nicht gewählt werden. |
| `placeholder` | „Placeholder" | Textfeld | optional | Platzhaltertext, der angezeigt wird, wenn kein Datum gewählt ist. |
| `disabled` | „Disabled" | typedInput (alle Binding-Arten) | optional | Bindbare Bedingung, die das Feld deaktiviert (Nutzerinteraktion gesperrt). |

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

Der `data-help-name="ui-datepicker"`-Hilfetext soll knapp sein: Zweck (Datums-/
Uhrzeiteingabe), Hinweis auf die drei Modi und das ISO-8601-Format des
emittierten Werts, `change`-Event und ein Link auf die ausführliche Doku:
`https://github.com/ollixx/node-red-contrib-webapp/blob/develop/docs/nodes/input/ui-datepicker.md`.

## Input

`ui-datepicker` hat einen **Eingangs-Port**, über den der Flow den Datumswert und
den Komponentenzustand steuert.

- **`msg.payload`** (nicht-null, ISO-8601-String) → aktualisiert das `value`-Feld
  des Knotens und sendet einen frischen Snapshot an alle verbundenen Clients der App.
- **`msg.ui.patch`** → überschreibt beliebige Felder der Knoten-Definition
  (z. B. `min`, `max`, `mode`, `disabled`). Binding-behaftete Felder (`value`)
  müssen als Binding-Objekt übergeben werden.
  Details: [inputs.md](../concepts/inputs.md).
- **`msg.ui.component.op`** → Komponentenoperation:
  - `show` / `hide` — Sichtbarkeit umschalten
  - `enable` / `disable` — Interaktion freigeben / sperren
  - `reset` — Wert auf den konfigurierten Initialwert zurücksetzen
- **Nicht erkannte / fachfremde Messages** → werden **unverändert durchgereicht**
  (Pass-Through), ohne Fehlerausgabe.

## Output

`ui-datepicker` hat einen **Ausgangs-Port**. Emittiert wird bei Nutzerinteraktion:

| Event | Wann | `msg.ui.params` | Intention |
|---|---|---|---|
| `change` | Nutzer wählt ein Datum / eine Uhrzeit | `value` — der neue Wert als ISO-8601-String (Format je nach `mode`) | Datum verarbeiten, Store aktualisieren, Gültigkeitsprüfung starten |

Gemeinsame `msg.ui`-Felder: `appId`, `clientId`, `event`, `sourceId`.

**Antizipierte Wiring-Szenarien:**
- `change` → `ui-store` (Datum speichern, z. B. `startDate`, `appointmentTime`).
- `change` → `function` → `min`/`max` des zweiten Datepickers dynamisch setzen (Datum-Bereich).
- `change` → `http request` → verfügbare Termine für das gewählte Datum laden.

## Theming

`ui-datepicker` trägt kein eigenes `variant`-Feld — es erbt Theme-Tokens der
Parent-App. Das Theme wird von `ui-app` über Design-Tokens vorgegeben;
das Backend bildet sie auf die Kalender-/Eingabe-Darstellung ab. Details:
[theming.md](../concepts/theming.md).

## Besonderheiten

- **ISO-8601-Wertformat.** `value` ist stets ein String im ISO-8601-Format, nicht
  ein JavaScript-`Date`-Objekt. Der Modus bestimmt die Präzision: `date` liefert
  `YYYY-MM-DD`, `datetime` liefert `YYYY-MM-DDTHH:mm`, `time` liefert `HH:mm`.
- **`min`/`max`-Grenzen.** Die Felder nehmen Datums-Strings im Format `YYYY-MM-DD`
  entgegen (auch bei Modus `datetime` und `time`), da Grenzen typischerweise
  tagesgenau definiert werden.
- **Write-Back (P204 / ADR 0027).** `value` liest, `writeTo` schreibt. Ist ein
  `writeTo`-Ziel gesetzt, persistiert die Runtime das gewählte Datum **zusätzlich**
  zum `change`-Event (additiv): bei `writeTrigger=submit` bei Enter/Blur, bei
  `change` bei jeder Auswahl. Store per-client + SSE-Re-Render; Flow/Global
  server-seitig ohne Auto-Re-Render.

## Referenzen

- [layout.md](../concepts/layout.md) — Platzierungsfelder und Presets
- [stores.md](../concepts/stores.md) — Binding-Arten; Ziel eines `writeTo=store`
- [inputs.md](../concepts/inputs.md) — `msg.payload`- und `msg.ui.patch`-Protokoll
- [events.md](../concepts/events.md) — Event-Format und Output-Ports
- [theming.md](../concepts/theming.md) — Design-Tokens
- [ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md) — `value` liest, `writeTo` schreibt

## Offene Punkte

- Datumsbereichs-Auswahl (zwei Griffe: `startDate`–`endDate`) ist noch nicht modelliert.
- Zeitzonenbehandlung (lokale Zeit vs. UTC) ist noch nicht spezifiziert.
- Dynamische `min`/`max`-Felder als Bindings (statt statischer Strings) sind noch nicht modelliert.
