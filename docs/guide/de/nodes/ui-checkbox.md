# ui-checkbox

Eine einzelne An/Aus-Checkbox, gebunden an einen Boolean im Client-State.

> English: [../../nodes/ui-checkbox.md](../../nodes/ui-checkbox.md)

## Zweck

`ui-checkbox` rendert eine Checkbox, deren Checked-Zustand zweiseitig an den
Client-State gebunden ist: **Value** liest den Boolean, **Write To** persistiert
das Umschalten. Anders als [`ui-radio`](ui-radio.md) ist sie ein *unabhängiges*
Flag — für mehrere unabhängige Optionen nimmt man mehrere Checkboxen.

## Wann einsetzen

- Ein einzelnes Boolean-Flag: „AGB akzeptieren", „Newsletter abonnieren",
  „angemeldet bleiben".
- Mehrere unabhängige Flags — je eine `ui-checkbox` pro Flag.
- Für ein Schalter-Control mit An/Aus-Beschriftung [`ui-switch`](ui-switch.md); für
  „genau eines von N" [`ui-radio`](ui-radio.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Checkbox N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung neben der Box. Pflicht, bindbar. | Binding / Literal | — |
| **Value Path** (`value`) | Die **Lese**-Hälfte: der Checked-Zustand. Mit jeder Binding-Art bindbar — typischerweise ein `store`-Binding auf einen Boolean-Sub-Pfad. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): nur `store`, `flow` oder `global`. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Eine Checkbox hat **keine Submit-Geste** — sie schreibt immer bei `change`. Nur `none` ist anders: es schaltet den automatischen Write-Back ab. | `submit` / `change` / `none` | `submit` |
| **Size** (`size`) | Größe der Checkbox (eigene Zeile, nicht die geteilte Size-Auswahl). | `Default` / `xs` / `sm` / `md` / `lg` / `xl` | `Default` |
| **Disabled** (`disabled`) | Bindbare Bedingung, die die Checkbox sperrt. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob die Checkbox gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-checkbox` hat **kein `variant`-Feld** — es erbt die Theme-Tokens der App.

### Value / Write To / Write Trigger

Das gemeinsame Modell der Input-Familie ([Formulare](../guides/forms.md)):
**Value Path** und **Write To** auf denselben Boolean-Store-Sub-Pfad binden
ergibt echte Zweiseitigkeit. Ohne Submit-Geste entscheidet der Trigger nur,
*ob* zurückgeschrieben wird.

## Eingang

`ui-checkbox` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null) | Setzt den Checked-Zustand (Boolean) und pusht einen frischen Snapshot. |
| `msg.ui.patch` | Überschreibt Definitionsfelder (`disabled`, …). Binding-behaftete Felder (`value`) als Binding-Objekt. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-checkbox` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | Nutzer hakt an oder ab | `checked` — der neue Boolean-Zustand |

Achtung auf den Parameternamen: eine Checkbox meldet **`checked`**, nicht
`value`. Trägt `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`. Ein
`submit`-Event gibt es nicht.

## Beispiele

### 1. AGB-Checkbox mit Live-Statuszeile

Ein `prefs`-Store, eine `ui-checkbox`, deren Value Path und Write To auf
`prefs.accepted` zeigen, und ein `ui-text`, der denselben Slice liest.

Flow-Datei: [`examples/guide/ui-checkbox.json`](../../../../examples/guide/ui-checkbox.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-checkbox.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideCheckbox/` öffnen und umschalten.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [`ui-radio`](ui-radio.md) — genau eines von N
- [`ui-store`](ui-store.md) — das übliche Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-checkbox.md`
