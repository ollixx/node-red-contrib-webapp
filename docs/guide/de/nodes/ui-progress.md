# ui-progress

Ein Fortschrittsbalken, Spinner oder Ring für Lade- und Fortschrittszustände.

> English (canonical): [nodes/ui-progress.md](../../nodes/ui-progress.md)

## Zweck

`ui-progress` zeigt einen **Fortschrittsbalken oder Lade-Indikator**. Der
`displayType` wählt Balken, Spinner oder Ring. Der Wert kommt aus einem Binding
(State, Query, Store oder der eingehenden Message). Fehlt der Wert, zeigt der
Knoten einen **indeterminate** (endlos animierten) Zustand — nicht Null.

## Wann einsetzen

- Determinierten Fortschritt einer bekannten Aufgabe zeigen (Upload 65 %,
  Import 3/10).
- Einen indeterminaten Busy-Zustand beim Warten zeigen (`value` leer lassen).
- Für Skelett-Platzhalter, die die Form ladender Inhalte nachahmen, stattdessen
  [`ui-skeleton`](ui-skeleton.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Progress N` |
| **Parent Slot** (`mount`) | Slot, in den der Knoten mountet. Pflicht. | Mount-Pfad | — |
| **Display Type** (`displayType`) | Die Darstellungsform (ein Darstellungstyp, kein semantischer Variant). | `bar` (horizontaler Balken), `spinner` (immer indeterminate), `circular` (Ring; ohne Wert ein Spinner) | `bar` |
| **Value** (`value`) | Der Fortschrittswert `0…max` (bindbar). Fehlt/`null` → indeterminate. | `literal` (num), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | leer |
| **Label** (`label`) | Beschriftung neben/über dem Fortschritt; auch das a11y-Label (bindbar). | kanonisches Value-Binding | leer |
| **Max** (`max`) | Obere Grenze des Bereichs; die Füllung skaliert `value / max`. | Zahl | `100` |
| **Show Value** (`showValue`) | Blendet den Prozentwert (relativ zu `max`) ein. Bei indeterminate/Spinner ignoriert. | Checkbox | aus |
| **Visible** (`visible`) | Basis-Feld — deklarative Sichtbarkeit (bindbarer Boolean). | Boolean-Binding | sichtbar |
| **Color** (`color`) | Basis-Feld — die Füllfarbe des Indikators (bindbar). Leer → Theme `colorPrimary`. | Value-Binding | Theme |

`Disabled` und `Size` sind N/A (ein Fortschrittsbalken hat keinen interaktiven
Zustand und keine Größen-Stufen). Es gibt kein `variant`/`severity` —
`displayType` ist eine Darstellungsform, keine Farbrolle.

## Eingang

`ui-progress` **hat einen Eingangs-Port** für Push-Updates:

- **`msg.payload`** aktualisiert `value` und pusht einen frischen Snapshot;
  andere Felder bleiben unverändert.
- **`msg.ui.patch`** — überschreibt Felder (`value`, `displayType`, `label`,
  `showValue`, `max`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — steuert die Sichtbarkeit.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Keine — `ui-progress` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Ein determinierter Fortschrittsbalken

Ein Balken bei 65 % von 100 mit Label und eingeblendetem Prozentwert; eine
Überschrift steht darüber, damit der App-Root nie leer ist.

Flow-Datei: [`examples/guide/ui-progress.json`](../../../../examples/guide/ui-progress.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-progress.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideProgress/` öffnen — ein gefüllter
   Balken zeigt „65%".

## Verwandt

- [`ui-skeleton`](ui-skeleton.md) — Platzhalter-Formen für ladende Inhalte
- [Bindings & State](../guides/bindings-state.md) — die Binding-Arten, Stores
- Contract-Doc (intern, deutsch): `docs/nodes/feedback/ui-progress.md`
