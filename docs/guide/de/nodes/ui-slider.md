# ui-slider

Ein numerischer Schieberegler mit Min/Max/Schrittweite und optionaler
Wertanzeige.

> English: [../../nodes/ui-slider.md](../../nodes/ui-slider.md)

## Zweck

`ui-slider` rendert einen horizontalen Schieberegler für eine Zahl und bindet
ihn zweiseitig an den Client-State: **Value** liest, **Write To** schreibt.
Einsetzen, wo der *Bereich* wichtiger ist als die exakten Ziffern.

## Wann einsetzen

- Lautstärke, Helligkeit, Schwellenwert, Prozentwert, Zoom-Stufe.
- Live-Vorschau: ein an einen Store-Slice gebundener Slider re-rendert jede an
  denselben Slice gebundene View schon während des Ziehens.
- Für eine exakt getippte Zahl [`ui-input`](ui-input.md) mit Eingabe-Typ
  `number`.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Slider N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung des Reglers. Optional — leer rendert kein Label. Bindbar. | Binding / Literal | leer |
| **Value** (`value`) | Die **Lese**-Hälfte: der numerische Wert. Mit jeder Binding-Art bindbar. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): nur `store`, `flow` oder `global`. Der Wert wird als numerischer String übergeben. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Ein Slider hat **keine Submit-Geste** — er schreibt immer bei `change` (während des Ziehens). Nur `none` ist anders: es schaltet den automatischen Write-Back ab. | `submit` / `change` / `none` | `submit` |
| **Min** (`min`) | Untere Bereichsgrenze. Leer = Backend-Default. | Zahl | leer |
| **Max** (`max`) | Obere Bereichsgrenze. Leer = Backend-Default. | Zahl | leer |
| **Step** (`step`) | Schrittweite des Reglers. Muss positiv sein. | Zahl > 0 | leer |
| **Show Value** (`showValue`) | Zeigt den aktuellen Zahlenwert neben dem Regler. | Checkbox | `false` |
| **Disabled** (`disabled`) | Bindbare Bedingung, die den Slider sperrt. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob der Slider gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-slider` hat **kein `variant`** und **keine Größen-Stufen** (die Size-Zeile
steht unter „Erweitert" mit N/A-Hinweis).

### Value / Write To / Write Trigger

Das gemeinsame Modell der Input-Familie ([Formulare](../guides/forms.md)):
**Value** und **Write To** auf denselben numerischen Store-Sub-Pfad binden
ergibt echte Zweiseitigkeit. Ohne Submit-Geste entscheidet der Trigger nur,
*ob* zurückgeschrieben wird — mit `change`/`submit` laufend während des Ziehens.

## Eingang

`ui-slider` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null) | Setzt den numerischen Wert (auf den konfigurierten `min`/`max`-Bereich geclippt) und pusht einen frischen Snapshot. |
| `msg.ui.patch` | Überschreibt Definitionsfelder (`min`, `max`, `step`, `disabled`, …). Binding-behaftete Felder (`value`, `disabled`) als Binding-Objekt. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-slider` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | Nutzer bewegt den Regler | `value` — der neue numerische Wert |

Trägt `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`. Ein
`submit`-Event gibt es nicht.

## Beispiele

### 1. Lautstärke-Slider mit Live-Anzeige

Ein `settings`-Store, ein `ui-slider` (0–100, Schritt 5, **Show Value** an),
dessen Value und Write To auf `settings.volume` zeigen, und ein `ui-text`,
der den Slice spiegelt.

Flow-Datei: [`examples/guide/ui-slider.json`](../../../../examples/guide/ui-slider.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-slider.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideSlider/` öffnen und den Regler ziehen.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [`ui-input`](ui-input.md) — getippte Zahlen (Eingabe-Typ `number`)
- [`ui-store`](ui-store.md) — das übliche Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-slider.md`
