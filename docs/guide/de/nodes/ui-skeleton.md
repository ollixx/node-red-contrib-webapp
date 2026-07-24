# ui-skeleton

Ein animierter Lade-Platzhalter, der die Form des echten Inhalts nachahmt.

> English (canonical): [nodes/ui-skeleton.md](../../nodes/ui-skeleton.md)

## Zweck

`ui-skeleton` rendert einen **animierten Lade-Platzhalter**, der die Form des
noch kommenden Inhalts imitiert. Er wird angezeigt, solange `visible` truthy ist
— typischerweise während ein Query lädt — und verschwindet, sobald die Daten
bereit sind, worauf die echten Komponenten übernehmen. Der `displayType` wählt
den Umriss des Platzhalters: Text-Zeilen, Avatar, Card oder Tabelle.

## Wann einsetzen

- Einen Slot mit einem Platzhalter füllen, während ein `ui-query` lädt; er teilt
  sich den Slot mit den echten Komponenten (deren Sichtbarkeit ist komplementär
  zur Sichtbarkeit des Skeletons).
- Der Seite während des Ladens eine stabile Form geben statt eines leeren
  Aufblitzens.
- Für einen determinierten/indeterminaten Fortschritts-Indikator statt eines
  Form-Platzhalters [`ui-progress`](ui-progress.md).

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Skeleton N` |
| **Parent Slot** (`mount`) | Slot, in den der Knoten mountet. Pflicht. | Mount-Pfad | — |
| **Display Type** (`displayType`) | Die Platzhalter-Form (ein Darstellungstyp, kein semantischer Variant). | `text` → `lines` gestapelte Platzhalter-Zeilen; `avatar` → ein **rundes** Element; `card` → ein Block (Medien + Zeilen in umrandeter Box); `table` → **`lines` Zeilen × 3 Spalten** | `text` |
| **Lines** (`lines`) | Anzahl simulierter Zeilen. Wirkt für `text` (Zeilenanzahl) **und** `table` (Zeilenanzahl, je 3 Spalten); für `avatar`/`card` ohne Wirkung. Ganze Zahl ≥ 1. | Zahl ≥ 1 | `3` |
| **Visible** (`visible`) | Basis-Feld — das Lade-Zustands-Gate (bindbarer Boolean). Truthy = Skeleton sichtbar; falsy = verborgen. Leer = immer sichtbar. Typisch ein `query`/`store`-„isLoading"-Wert. | Boolean-Binding | sichtbar |
| **Color** (`color`) | Basis-Feld — färbt die Platzhalter-/Shimmer-Fläche (Theme-Token, semantischer Token oder CSS-Farbe). Leer = neutrale Theme-Farbe. | Value-Binding | neutral |

`Disabled` und `Size` sind N/A (ein Lade-Platzhalter ist nicht interaktiv und hat
keine Größen-Stufen). Es gibt kein `variant`/`severity` — `displayType` ist eine
Darstellungsform.

## Eingang

`ui-skeleton` **hat einen Eingangs-Port**, aber einen **engen** (konformitäts-
gemessen, P241):

- **`msg.ui.component.op`** (`show`, `hide`, `enable`, `disable`, …) — schaltet
  Sichtbarkeit/Interaktion zusätzlich zum `visible`-Binding.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.
- **`msg.ui.patch` wird derzeit NICHT unterstützt** — eine eingehende Message
  überschreibt `displayType` oder `lines` nicht. (Ob sie das soll, ist eine
  offene, knotenübergreifende Owner-Entscheidung; dies beschreibt das heutige
  Verhalten.)

## Ausgänge / Events

Keine — `ui-skeleton` hat keinen Output-Port und emittiert keine Events.

## Beispiele

### 1. Ein Text-Skeleton

Ein Text-Skeleton aus vier Platzhalter-Zeilen als Platzhalter für ladenden
Inhalt; eine Überschrift steht darüber, damit der App-Root nie leer ist.

Flow-Datei: [`examples/guide/ui-skeleton.json`](../../../../examples/guide/ui-skeleton.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-skeleton.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideSkeleton/` öffnen — vier schimmernde
   Platzhalter-Zeilen erscheinen.

## Verwandt

- [`ui-progress`](ui-progress.md) — ein determinierter/indeterminater Fortschritts-Indikator
- [`ui-query`](../guides/displaying-data.md) — die typische „isLoading"-Datenquelle
- [Bindings & State](../guides/bindings-state.md) — die Boolean-Binding-Arten
- Contract-Doc (intern, deutsch): `docs/nodes/feedback/ui-skeleton.md`
