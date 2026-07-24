# ui-datepicker

Ein Feld für Datum, Datum+Uhrzeit oder Uhrzeit, dessen Wert ein
ISO-8601-String ist.

> English: [../../nodes/ui-datepicker.md](../../nodes/ui-datepicker.md)

## Zweck

`ui-datepicker` rendert ein Datums-/Zeit-Eingabefeld und bindet es zweiseitig an
den Client-State: **Value Path** liest, **Write To** schreibt. Der Wert ist
immer ein ISO-8601-String, dessen genaue Form dem gewählten **Mode** folgt.

## Wann einsetzen

- Startdatum, Fälligkeitsdatum, Termin-Uhrzeit, Geburtstag.
- Ein Datums-Bereich — zwei Datepicker nutzen und das **Min** des zweiten aus
  dem `change`-Event des ersten setzen.
- Für ein Freitext-Datum [`ui-input`](ui-input.md); das Parsen liegt dann bei dir.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Datepicker N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung über dem Feld. Pflicht, bindbar. | Binding / Literal | — |
| **Value Path** (`value`) | Die **Lese**-Hälfte: das Datum als ISO-8601-String — `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` oder `HH:mm` je nach **Mode**. Mit jeder Binding-Art bindbar. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): nur `store`, `flow` oder `global`. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Der Datepicker rendert ein **text-artiges** Input und honoriert den Trigger daher wirklich: `submit` schreibt bei Enter/Blur, `change` bei jeder Auswahl, `none` schaltet den Write-Back ab. | `submit` / `change` / `none` | `submit` |
| **Mode** (`mode`) | Was eingegeben wird. `date` = nur Datum; `datetime` = Datum und Uhrzeit; `time` = nur Uhrzeit. | `date` / `datetime` / `time` | `date` |
| **Min** (`min`) | Frühestes erlaubtes Datum — frühere Tage sind im Kalender deaktiviert. | Text `YYYY-MM-DD` | leer |
| **Max** (`max`) | Spätestes erlaubtes Datum — spätere Tage sind im Kalender deaktiviert. | Text `YYYY-MM-DD` | leer |
| **Placeholder** (`placeholder`) | Hinweis, solange nichts gewählt ist. Bindbar. | Binding / Literal | leer |
| **Disabled** (`disabled`) | Bindbare Bedingung, die das Feld sperrt. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob das Feld gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-datepicker` hat **kein `variant`** und **keine Größen-Stufen** (die
Size-Zeile steht unter „Erweitert" mit N/A-Hinweis).

### Value / Write To / Write Trigger

Das gemeinsame Modell der Input-Familie ([Formulare](../guides/forms.md)):
**Value Path** und **Write To** auf denselben Store-Sub-Pfad binden ergibt echte
Zweiseitigkeit. Anders als Checkbox/Switch/Select/Radio ist dieses Control
text-artig — der Trigger entscheidet hier tatsächlich, **wann** geschrieben wird.

## Eingang

`ui-datepicker` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null, ISO-8601-String) | Setzt den Wert und pusht einen frischen Snapshot. |
| `msg.ui.patch` | Überschreibt Definitionsfelder (`min`, `max`, `mode`, `disabled`, …). Binding-behaftete Felder (`value`) als Binding-Objekt. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-datepicker` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | Nutzer wählt Datum / Uhrzeit | `value` — der neue ISO-8601-String (Form je **Mode**) |

Trägt `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`.

## Beispiele

### 1. Begrenztes Startdatum-Feld mit Live-Echo

Ein `booking`-Store, ein `ui-datepicker` im Modus `date` mit **Min**/**Max**,
dessen Value Path und Write To auf `booking.start` zeigen, und ein `ui-text`,
der denselben Slice liest.

Flow-Datei: [`examples/guide/ui-datepicker.json`](../../../../examples/guide/ui-datepicker.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-datepicker.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideDatepicker/` öffnen und ein Datum wählen.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [`ui-input`](ui-input.md) — Freitext-Alternative
- [`ui-store`](ui-store.md) — das übliche Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-datepicker.md`
