# ui-switch

Ein Kippschalter für einen Boolean, mit optionaler An/Aus-Beschriftung.

> English: [../../nodes/ui-switch.md](../../nodes/ui-switch.md)

## Zweck

`ui-switch` rendert einen Toggle-Switch, dessen Zustand zweiseitig an den
Client-State gebunden ist: **Value Path** liest den Boolean, **Write To**
persistiert das Umschalten. Er ist die „Einstellungs"-Variante eines
Boolean-Controls — [`ui-checkbox`](ui-checkbox.md) ist die
„Formularfeld"-Variante.

## Wann einsetzen

- Einstellungen, die sofort wirken: Benachrichtigungen an/aus, Dark Mode,
  Live-Update-Schalter.
- Überall dort, wo ein An/Aus-Zustand als Schalter statt als Häkchen gelesen
  werden soll.
- Für ein Formularfeld mit Zustimmungs-Semantik [`ui-checkbox`](ui-checkbox.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Switch N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Value Path** (`value`) | Die **Lese**-Hälfte: der Toggle-Zustand. Mit jeder Binding-Art bindbar — typischerweise ein `store`-Binding auf einen Boolean-Sub-Pfad. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): nur `store`, `flow` oder `global`. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Ein Switch hat **keine Submit-Geste** — er schreibt immer bei `change`. Nur `none` ist anders: es schaltet den automatischen Write-Back ab. | `submit` / `change` / `none` | `submit` |
| **Label** (`label`) | Beschriftung neben dem Switch. Optional — leer rendert kein Label. Bindbar. | Binding / Literal | leer |
| **Label On** (`labelOn`) | Text im eingeschalteten Zustand (z. B. „An"). Bindbar. | Binding / Literal | leer |
| **Label Off** (`labelOff`) | Text im ausgeschalteten Zustand (z. B. „Aus"). Bindbar. | Binding / Literal | leer |
| **Disabled** (`disabled`) | Bindbare Bedingung, die den Switch sperrt. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob der Switch gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-switch` hat **kein `variant`** und **keine Größen-Stufen** (die Size-Zeile
steht unter „Erweitert" mit N/A-Hinweis).

### Value / Write To / Write Trigger

Das gemeinsame Modell der Input-Familie ([Formulare](../guides/forms.md)):
**Value Path** und **Write To** auf denselben Boolean-Store-Sub-Pfad binden
ergibt echte Zweiseitigkeit. Ohne Submit-Geste entscheidet der Trigger nur,
*ob* zurückgeschrieben wird.

## Eingang

`ui-switch` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null) | Setzt den Toggle-Zustand (Boolean) und pusht einen frischen Snapshot. |
| `msg.ui.patch` | Überschreibt Definitionsfelder (`label`, `labelOn`, `labelOff`, `disabled`, …). Binding-behaftete Felder (`value`) als Binding-Objekt. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-switch` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | Nutzer kippt den Switch | `checked` — der neue Boolean-Zustand |

Achtung auf den Parameternamen: ein Switch meldet **`checked`**, nicht `value`.
Trägt `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`. Ein
`submit`-Event gibt es nicht.

## Beispiele

### 1. Benachrichtigungs-Switch mit An/Aus-Beschriftung

Ein `settings`-Store, ein `ui-switch` mit **Label On** / **Label Off**, dessen
Value Path und Write To auf `settings.notify` zeigen, und ein `ui-text`, der
denselben Slice liest.

Flow-Datei: [`examples/guide/ui-switch.json`](../../../../examples/guide/ui-switch.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-switch.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideSwitch/` öffnen und umschalten.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [`ui-checkbox`](ui-checkbox.md) — die Formularfeld-Variante eines Booleans
- [`ui-store`](ui-store.md) — das übliche Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-switch.md`
