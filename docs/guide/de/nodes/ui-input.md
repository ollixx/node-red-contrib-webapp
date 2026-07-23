# ui-input

Ein einzeiliges Textfeld, dessen Wert aus dem Client-State liest und in einen
Store zurückschreibt — ganz ohne Verdrahtung.

> English: [../../nodes/ui-input.md](../../nodes/ui-input.md)

## Zweck

`ui-input` rendert ein einzeiliges Eingabefeld (`text`, `email` oder `number`)
und verbindet es in **beide Richtungen** mit dem Zustand der App: **Value** ist
die Lese-Hälfte (was das Feld anzeigt), **Write To** die Schreib-Hälfte (wohin
die Nutzeränderung persistiert wird). Es ist das Arbeitspferd der
Input-Familie — das gemeinsame Modell steht im [Formular-Guide](../guides/forms.md).

## Wann einsetzen

- Ein Formularfeld für Name, E-Mail, Zahl oder Suchbegriff.
- Überall dort, wo ein Store-Slice zweiseitig gebunden werden soll — ohne
  `function`-Knoten.
- Nicht für mehrzeiligen Text — dafür [`ui-textarea`](ui-textarea.md).
- Nicht für eine feste Auswahlmenge — dafür [`ui-select`](ui-select.md) oder
  [`ui-radio`](ui-radio.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Input N` |
| **Parent Slot** (`mount`) | Einbauort — ein Slot einer `ui-app`, `ui-route`, `ui-dialog` oder `ui-container`. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung über dem Feld. Pflicht. Bindbar (voller Binding-Satz). | Binding / Literal | — |
| **Value** (`value`) | Die **Lese**-Hälfte: was das Feld anzeigt. Mit jeder Binding-Art bindbar — typischerweise ein `store`-Binding mit Sub-Pfad. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): wohin die Nutzeränderung persistiert wird. Nur *schreibbare* Arten: `store` (ein `ui-store` + optionaler ein-Ebenen-Sub-Pfad), `flow`, `global`. Leer lassen = kein automatischer Write-Back. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Wann geschrieben wird. `submit` = bei Enter/Blur; `change` = bei jedem Tastendruck; `none` = nie (Persistenz selbst aus dem `change`-Event verdrahten). | `submit` / `change` / `none` | `submit` |
| **Input Type** (`inputType`) | Semantischer Eingabe-Typ — steuert Tastatur-Typ und die native Browser-Validierung. Pflicht. | `text` / `email` / `number` | `text` |
| **Variant** (`variant`) | Visuelle Feld-Rolle. | `default` / `filled` / `outlined` | `default` |
| **Size** (`size`) | Größe des Controls. Leer = Backend-Default. | `(default)` / `sm` / `md` / `lg` | leer |
| **Disabled** (`disabled`) | Bindbare Bedingung, die das Feld sperrt. Ein truthy Store-Wert deaktiviert es live. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob das Feld überhaupt gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot; welche Felder gelten, hängt vom Layout-Preset des Parents ab — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

### Value / Write To / Write Trigger in einem Absatz

Die beiden gleich aussehenden typedInputs sind bewusst getrennt. Bindet man
**Value** und **Write To** auf denselben Store-Sub-Pfad, wird das Feld echt
zweiseitig: es zeigt den Slice **und** persistiert Änderungen dorthin, und jede
andere an diesen Slice gebundene View re-rendert live. Store-Writes sind
per-client und pushen einen frischen Snapshot über den Live-Stream;
`flow`/`global`-Writes laufen server-seitig und lösen **kein** Re-Render aus.
Der Write-Back ist **additiv** — die `change`/`submit`-Events feuern
unabhängig davon.

> **Placeholder:** Schema und Runtime akzeptieren ein `placeholder` an
> `ui-input`, der **Editor hat dafür aber keine Zeile** — es lässt sich nur per
> Hand im Flow-JSON oder über `msg.ui.patch` setzen. (Das Contract-Doc
> `docs/nodes/input/ui-input.md` führt es weiterhin als Editor-Feld; siehe
> [Bekannte Lücken](#bekannte-lücken).)

## Eingang

`ui-input` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null) | Aktualisiert das `value` des Knotens und pusht einen frischen Snapshot an die Clients der App — z. B. Vorbefüllen aus einem `inject`. |
| `msg.ui.patch` | Überschreibt beliebige Felder der Knoten-Definition (`placeholder`, `disabled`, `inputType`, …). Binding-behaftete Felder als Binding-Objekt übergeben. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `focus`, `reset` (zurück auf den konfigurierten Initialwert). |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-input` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | bei jeder Änderung des Feldwerts | `value` — der neue Wert |
| `submit` | bei Enter / Submit | `value` — der bestätigte Wert |

Beide tragen `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`.

## Beispiele

### 1. Zweiseitig gebundenes Textfeld mit Live-Vorschau

Eine App mit `draft`-Store, ein `ui-input`, dessen Value *und* Write To auf
`draft.name` zeigen (Trigger `change`), und ein `ui-text` auf demselben Slice.
Der Store startet mit `Ada Lovelace`; beim Tippen folgt die Vorschau bei jedem
Tastendruck.

Flow-Datei: [`examples/guide/ui-input.json`](../../../../examples/guide/ui-input.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-input.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideInput/` öffnen und tippen.

## Bekannte Lücken

- Das Contract-Doc führt ein `placeholder`-**Editor-Feld**; das Editor-Template
  rendert keines (Runtime + Schema unterstützen die Property sehr wohl).
  Gemeldet mit P268.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten
- [`ui-textarea`](ui-textarea.md) · [`ui-select`](ui-select.md) · [`ui-switch`](ui-switch.md)
- [`ui-store`](ui-store.md) — das übliche Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-input.md`
