# ui-select

Ein Dropdown zur Auswahl eines — oder mehrerer — Werte aus einer statischen
oder store-getriebenen Optionsliste.

> English: [../../nodes/ui-select.md](../../nodes/ui-select.md)

## Zweck

`ui-select` rendert ein Dropdown bzw. eine Combobox. Die Optionen kommen
entweder aus validiertem statischem JSON oder reaktiv aus einem Store; die
Auswahl ist zweiseitig an den Client-State gebunden: **Value** liest,
**Write To** schreibt.

## Wann einsetzen

- Einen Wert aus einer bekannten Liste wählen (Status, Land, Kategorie).
- Mehrere Werte gleichzeitig wählen (**Multiple**).
- Optionen, die sich zur Laufzeit ändern — **Options** an einen Store-Slice
  binden, den der Flow füllt.
- Für 2–5 sich ausschließende Optionen, die alle sichtbar sein sollen, eher
  `ui-radio`.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Select N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung über dem Dropdown. Pflicht, bindbar. | Binding / Literal | — |
| **Value** (`value`) | Die **Lese**-Hälfte: der aktuell gewählte Wert. Mit **Multiple** ein Array. Mit jeder Binding-Art bindbar. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): nur `store`, `flow` oder `global`. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Ein Select hat **keine Submit-Geste** und schreibt daher immer bei `change` — `submit` und `change` verhalten sich hier gleich. Nur `none` ist anders: es schaltet den automatischen Write-Back ganz ab. | `submit` / `change` / `none` | `submit` |
| **Options** (`options`) | Ein Feld, zwei Typen. **json** nutzt den JSON-Editor von Node-RED und wird vor dem Deploy validiert (Knoten wird rot) — genau eine von drei Formen: Objekt `{"<Label>": "<Wert>"}`, String-Array `["A","B"]` (Wert = Label) oder Objekt-Array `[{"label":…,"value":…}]`. **store** liest die Optionen reaktiv aus einem Store-Pfad. Leer rendert ein Dropdown ohne Optionen. | `json` / `store` | leer |
| **Placeholder** (`placeholder`) | Hinweis, solange nichts gewählt ist. Bindbar. | Binding / Literal | leer |
| **Multiple** (`multiple`) | Mehrfachauswahl erlauben. Bei `true` ist `value` ein Array der gewählten Werte. | Checkbox | `false` |
| **Size** (`size`) | Größe des Controls. | `(default)` / `sm` / `md` / `lg` | leer |
| **Disabled** (`disabled`) | Bindbare Bedingung, die das Dropdown sperrt. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob das Dropdown gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-select` hat **kein `variant`-Feld** — es erbt die Theme-Tokens der App.

### Value / Write To / Write Trigger

Das gemeinsame Modell der Input-Familie ([Formulare](../guides/forms.md)):
**Value** und **Write To** auf denselben Store-Sub-Pfad binden ergibt echte
Zweiseitigkeit. Da es keine Submit-Geste gibt, entscheidet die
Trigger-Einstellung nur, *ob* (nicht *wann*) zurückgeschrieben wird: `none` =
aus, alles andere = bei `change`.

## Eingang

`ui-select` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null) | Setzt den gewählten Wert und pusht einen frischen Snapshot. Mit **Multiple** muss das Payload ein Array sein. |
| `msg.ui.patch` | Überschreibt Definitionsfelder (`options`, `placeholder`, `disabled`, …). Binding-behaftete Felder (`value`, `options`) als Binding-Objekt. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-select` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | Nutzer ändert die Auswahl | `value` — der neue Wert (mit **Multiple** ein Array) |

Trägt `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`. Ein
`submit`-Event gibt es nicht.

## Beispiele

### 1. Status-Dropdown mit statischen Optionen und Live-Echo

Ein `filter`-Store, ein `ui-select` mit drei statischen Optionen, dessen Value
und Write To auf `filter.status` zeigen, und ein `ui-text`, der die Auswahl
spiegelt.

Flow-Datei: [`examples/guide/ui-select.json`](../../../../examples/guide/ui-select.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-select.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideSelect/` öffnen und den Wert ändern.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [Bindings & State](../guides/bindings-state.md) — store-getriebene Optionslisten
- [`ui-store`](ui-store.md) — Optionsquelle und Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-select.md`
