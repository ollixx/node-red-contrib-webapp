# Formulare

Die Input-Familie und das bidirektionale Value-Binding: lesen über
**Value**, zurückschreiben über **Write To** — ganz ohne Wiring.

> English (canonical): [../../guides/forms.md](../../guides/forms.md)

## Ziel

Ein kleines Formular bauen, dessen Felder aus einem Store-Slice lesen und
hinein persistieren, den richtigen Write-Trigger pro Control wählen und
wissen, wie die Input-Events dazu passen.

## Voraussetzungen

- [Bindings & State](bindings-state.md) — Stores und das Store-Binding.

## Die Input-Familie

Alle Eingabe-Controls folgen demselben Modell: `ui-input` (einzeiliger
Text, E-Mail, Zahl), `ui-textarea`, `ui-select`, `ui-checkbox`,
`ui-switch`, `ui-radio`, `ui-slider`, `ui-datepicker`.

Jedes hat ein **Label**, einen bindbaren **Value**, ein optionales
**Write To**-Ziel mit einem **Write Trigger**, eine bindbare
**Disabled**-Bedingung und einen Output-Port, der `change`- und (bei
Text-Controls) `submit`-Events emittiert.

## Bidirektionales Binding: Value liest, Write To schreibt

Ein Input braucht zwei Hälften, ausgedrückt als zwei gleich aussehende
typedInputs:

- **Value** — die *Lese*-Quelle: was das Feld anzeigt. Jede Binding-Art
  funktioniert (Store, Query, Route-Param, Literal, msg, …).
- **Write To** — das *Schreib*-Ziel: wohin die Nutzeränderung
  persistiert wird. Nur schreibbare Arten stehen zur Wahl: **Store**
  (ein `ui-store` plus optionaler Sub-Pfad), **Flow** oder **Global** —
  in eine berechnete Quelle wie eine Query kann man nicht schreiben.

Der häufigste Fall ist symmetrisch: Value und Write To an denselben
Store-Sub-Pfad binden (`draft.name`). Das Feld zeigt dann das Slice an
*und* persistiert Änderungen hinein — echtes Two-Way-Binding mit **null
Wiring**. Jeder andere View auf dasselbe Slice (ein Vorschau-Text, eine
Zusammenfassung) aktualisiert sich live beim Tippen.

Schreiben in einen Store ist per-Client und pusht einen frischen
Snapshot über den Live-Stream. Schreiben in Flow/Global-Context ist
server-seitig und re-rendert *nicht* automatisch — Store ist das
erstklassige, reaktive Ziel.

### Write Trigger

| Trigger | Verhalten |
|---|---|
| `submit` (Default) | Text-Controls persistieren bei Enter oder Blur |
| `change` | persistieren bei jeder Eingabe |
| `none` | kein automatischer Write-Back — Persistenz selbst verdrahten (`change`-Event → `function` → `ui-store`) |

Nicht-Text-Controls (Checkbox, Switch, Select, Radio, Slider) haben
keine Submit-Geste — sie persistieren unabhängig von der Einstellung bei
`change`.

### Events feuern weiterhin

Unabhängig vom Write-Back emittiert jedes Control seine
`change`/`submit`-Events am Output-Port (mit dem aktuellen Wert in den
Params). Nutze sie für die Flow-Seite eines Formulars: server-seitig
validieren, beim Submit in eine Datenbank speichern, einen Dialog
schließen — siehe [Actions & Events](actions-events.md).

## Validierungs-Verhalten

Validierung ist heute bewusst schlank:

- Der **Input Type** von `ui-input` (`text` / `email` / `number`) wählt
  Tastatur-Typ und browser-native Validierung des Feldes.
- Das **Disabled**-Binding steuert, ob der Nutzer überhaupt editieren
  kann — binde es an ein Store-Flag oder einen Reactive-Ausdruck für
  konditionale Formulare.
- Fachliche Validierung gehört in den Flow: auf das `submit`-Event
  reagieren, Werte prüfen und mit einem Store-Update oder einem Alert
  antworten.

## Schritte

1. Erstelle eine App mit einem `ui-store` (State Path `draft`, Initial
   Value `{"name":"","email":"","newsletter":false}`).
2. Füge einen `ui-input` „Name" hinzu: **Value** und **Write To** an den
   Store mit Sub-Pfad `name` binden, Write Trigger `change`.
3. Füge einen `ui-input` „Email" mit Input Type `email` hinzu,
   Value/Write To auf Sub-Pfad `email`, Write Trigger `submit` (der
   Default).
4. Füge einen `ui-switch` „Newsletter" mit Value/Write To auf Sub-Pfad
   `newsletter` hinzu.
5. Füge einen `ui-text` hinzu, gebunden an den `name`-Sub-Pfad des
   Stores, als Live-Vorschau. Deploy: Tippen im Name-Feld aktualisiert
   die Vorschau bei jedem Anschlag; das Email-Feld persistiert erst bei
   Enter/Blur; der Switch persistiert sofort.

## Beispiel-Flow

Das fertige Ergebnis der Schritte:
[`examples/guide/forms.json`](../../../../examples/guide/forms.json)

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. Die Datei `examples/guide/forms.json` auswählen (oder ihr JSON
   einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/formsApp/` öffnen — in die Felder
   tippen und die Live-Vorschau beobachten.

## Wie weiter

- [Navigation & Dialoge](navigation-dialogs.md) — ein Formular in einen
  Dialog setzen.
- [Daten anzeigen](displaying-data.md) — die gespeicherten Datensätze
  auflisten.
