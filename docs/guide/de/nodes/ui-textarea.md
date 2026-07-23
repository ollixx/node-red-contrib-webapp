# ui-textarea

Ein mehrzeiliges Textfeld mit optionalem Zeichenzähler — das Langform-Geschwister
von [`ui-input`](ui-input.md).

> English: [../../nodes/ui-textarea.md](../../nodes/ui-textarea.md)

## Zweck

`ui-textarea` rendert ein mehrzeiliges Eingabefeld und bindet es zweiseitig an
den Client-State: **Value** liest, **Write To** schreibt. Die Höhe legt
**Lines** fest, **Max Length** schaltet einen Live-Zeichenzähler ein, der die
Eingabe zugleich begrenzt.

## Wann einsetzen

- Kommentare, Notizen, Beschreibungen, Adressen, Nachrichtentexte.
- Jeder Freitext, der nicht in eine Zeile passt.
- Für eine einzelne Zeile stattdessen [`ui-input`](ui-input.md) — dessen
  `submit`-Geste ist Enter, das die Textarea für Zeilenumbrüche braucht.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor und in Pickern. | Freitext | `Textarea N` |
| **Parent Slot** (`mount`) | Einbauort. Pflicht. | Mount-Picker | — |
| **Label** (`label`) | Beschriftung über dem Feld. Pflicht. Bindbar. | Binding / Literal | — |
| **Value** (`value`) | Die **Lese**-Hälfte: der angezeigte Text. Mit jeder Binding-Art bindbar. | Binding | — |
| **Write To** (`writeTo`) | Die **Schreib**-Hälfte ([ADR 0027](../../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): nur `store`, `flow` oder `global`. Leer = kein automatischer Write-Back. | `store` / `flow` / `global` | leer |
| **Write Trigger** (`writeTrigger`) | Wann geschrieben wird. Bei einer Textarea bedeutet `submit` **Blur** (Feld verlassen) — Enter fügt einen Zeilenumbruch ein. | `submit` / `change` / `none` | `submit` |
| **Placeholder** (`placeholder`) | Hinweistext bei leerem Feld. Bindbar. | Binding / Literal | leer |
| **Lines** (`lines`) | Anzahl sichtbarer Textzeilen (Feldhöhe). Leer = Backend-Default. | Ganzzahl ≥ 1 | leer |
| **Max Length** (`maxLength`) | Maximale Zeichenzahl. Gesetzt erscheint ein Zeichenzähler; Eingaben über die Grenze werden verhindert. | Ganzzahl ≥ 1 | leer |
| **Size** (`size`) | Größe des Controls. | `(default)` / `sm` / `md` / `lg` | leer |
| **Disabled** (`disabled`) | Bindbare Bedingung, die das Feld sperrt. | Binding (Boolean-Satz) | ungesetzt |
| **Visible** (`visible`) | Bindbare Bedingung, ob das Feld gerendert wird. | Binding (Boolean-Satz) | ungesetzt |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Platzierung im Parent-Slot — siehe [Layout & Slots](../guides/layout-slots.md). | Zahlen | leer |

`ui-textarea` hat **kein `variant`-Feld** — es erbt die Theme-Tokens der App.

> **Migrations-Notiz (P229):** das Höhenfeld hieß früher `rows`. Es heißt jetzt
> `lines`; ein Alt-`rows` wird beim Öffnen im Editor verlustfrei migriert, und
> die Runtime liest `rows` aus alt-deployten Configs weiterhin. Eine
> `rows`-Editor-Zeile gibt es nicht mehr.

### Value / Write To / Write Trigger

Dasselbe Modell wie in der ganzen Input-Familie (siehe
[Formulare](../guides/forms.md)): **Value** und **Write To** auf denselben
Store-Sub-Pfad binden ergibt echte Zweiseitigkeit. Store-Writes sind per-client
und re-rendern gebundene Views live; `flow`/`global`-Writes laufen server-seitig
ohne Re-Render. Der Write-Back ist additiv — die `change`/`submit`-Events
feuern in jedem Fall.

## Eingang

`ui-textarea` **hat einen Eingangs-Port**.

| Message | Wirkung |
|---|---|
| `msg.payload` (nicht null) | Aktualisiert das `value` und pusht einen frischen Snapshot an die Clients der App. |
| `msg.ui.patch` | Überschreibt Definitionsfelder (`placeholder`, `lines`, `maxLength`, `disabled`, …). Binding-behaftete Felder als Binding-Objekt. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `focus`, `reset`. |
| alles andere | Wird **unverändert durchgereicht**, ohne Fehler. |

## Ausgänge / Events

`ui-textarea` **hat einen Ausgangs-Port**.

| Event | Wann | `msg.ui.params` |
|---|---|---|
| `change` | bei jeder Änderung des Textes | `value` — der aktuelle Text |
| `submit` | bei der Submit-Geste (Strg+Enter / Feld verlassen) | `value` — der bestätigte Text |

Beide tragen `appId`, `clientId`, `event` und `sourceId` auf `msg.ui`.

## Beispiele

### 1. Kommentarfeld mit Zähler und Live-Vorschau

Ein `draft`-Store, eine `ui-textarea` (6 Zeilen, max. 200 Zeichen), deren Value
und Write To auf `draft.comment` zeigen (Trigger `change`), und ein `ui-text`,
der denselben Slice spiegelt.

Flow-Datei: [`examples/guide/ui-textarea.json`](../../../../examples/guide/ui-textarea.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-textarea.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideTextarea/` öffnen und tippen.

## Verwandt

- [Formulare](../guides/forms.md) — die Input-Familie, zweiseitiges value/writeTo
- [`ui-input`](ui-input.md) — das einzeilige Geschwister
- [`ui-store`](ui-store.md) — das übliche Write-To-Ziel
- Contract-Doc (intern, Deutsch): `docs/nodes/input/ui-textarea.md`
