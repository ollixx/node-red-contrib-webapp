# ui-radio

Eine Radio-Gruppe: genau eine Option aus einer kleinen, stets sichtbaren Menge.

> English: [../../nodes/ui-radio.md](../../nodes/ui-radio.md)

## Zweck

`ui-radio` rendert eine Gruppe von Radio-Buttons. Es ist immer genau eine
Option gewählt; die Auswahl ist zweiseitig an den Client-State gebunden:
**Value** liest, **Write To** schreibt. Das Options-Modell teilt sich der Knoten
mit [`ui-select`](ui-select.md).

## Wann einsetzen

- 2–5 sich ausschließende Optionen, die alle gleichzeitig sichtbar sein sollen
  (Rolle, Versandart, Zahlungsart).
- Wenn das Vergleichen der Optionen wichtiger ist als Platzersparnis.
- Für lange Listen oder Mehrfachauswahl [`ui-select`](ui-select.md); für
  unabhängige An/Aus-Flags `ui-checkbox`.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Radio N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung der Gruppe. Pflicht, bindbar (derselbe Satz wie `ui-select`). | Binding / Literal | — |
| **Value** (`value`) | Die **Lese**-Hälfte: der Wert der aktuell gewählten Option. Mit jeder Binding-Art bindbar. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): nur `store`, `flow` oder `global`. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Eine Radio-Gruppe hat **keine Submit-Geste** — sie schreibt immer bei `change`. Nur `none` ist anders: es schaltet den automatischen Write-Back ab. | `submit` / `change` / `none` | `submit` |
| **Options** (`options`) | Ein Feld, zwei Typen — **derselbe Helfer wie bei `ui-select`**. **json** validiert genau eine von drei Formen: Objekt `{"<Label>": "<Wert>"}`, String-Array `["A","B"]` oder Objekt-Array `[{"label":…,"value":…}]` (bei falscher Struktur wird der Knoten rot). **store** liest die Optionen reaktiv aus einem Store-Pfad. Optional: eine unkonfigurierte Gruppe bleibt gültig. | `json` / `store` | leer |
| **Orientation** (`orientation`) | Anordnung der Buttons. `vertical` = untereinander; `horizontal` = nebeneinander. | `vertical` / `horizontal` | `vertical` |
| **Disabled** (`disabled`) | Bindbare Bedingung, die die ganze Gruppe sperrt. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob die Gruppe gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-radio` hat **kein `variant`** und **keine Größen-Stufen** (die Size-Zeile
steht im Editor unter „Erweitert" mit N/A-Hinweis). Anders als `ui-select` hat
es keinen **Placeholder**.

### Value / Write To / Write Trigger

Das gemeinsame Modell der Input-Familie ([Formulare](../guides/forms.md)):
**Value** und **Write To** auf denselben Store-Sub-Pfad binden ergibt echte
Zweiseitigkeit. Ohne Submit-Geste entscheidet der Trigger nur, *ob*
zurückgeschrieben wird.

## Eingang

`ui-radio` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null) | Setzt den Wert der vorgewählten Option und pusht einen frischen Snapshot. |
| `msg.ui.patch` | Überschreibt Definitionsfelder (`options`, `orientation`, `disabled`, …). Binding-behaftete Felder (`value`, `options`) als Binding-Objekt. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-radio` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | Nutzer wählt eine andere Option | `value` — der Wert der neu gewählten Option |

Trägt `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`. Ein
`submit`-Event gibt es nicht.

## Beispiele

### 1. Horizontale Rollenauswahl, an einen Store gebunden

Ein `form`-Store, ein `ui-radio` mit drei statischen Optionen in horizontaler
Anordnung, dessen Value und Write To auf `form.role` zeigen, und ein `ui-text`,
der die Wahl spiegelt.

Flow-Datei: [`examples/guide/ui-radio.json`](../../../../examples/guide/ui-radio.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-radio.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideRadio/` öffnen und eine Option wählen.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [`ui-select`](ui-select.md) — dasselbe Options-Modell, für lange Listen / Mehrfachauswahl
- [`ui-store`](ui-store.md) — Optionsquelle und Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-radio.md`
