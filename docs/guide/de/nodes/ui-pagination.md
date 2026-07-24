# ui-pagination

Seitennavigations-Controls (Vor/Zurück, Seitenzahl) für einen paginierten
Datensatz.

> English (canonical): [nodes/ui-pagination.md](../../nodes/ui-pagination.md)

## Zweck

`ui-pagination` rendert **Seitennavigations-Controls** — Vor/Zurück-Buttons und
ein Seiten-Label — für paginierte Daten. Der Knoten zeigt aktuelle Seite und
Gesamtzahl aus bindbaren Feldern und emittiert ein `pageChange`-Event, wenn der
Nutzer navigiert. Er arbeitet typischerweise mit [`ui-query`](ui-query.md) und
[`ui-store`](ui-store.md) zusammen: der Store hält die aktuelle Seite, `ui-query`
lädt die passenden Daten, und `ui-pagination` ist das Steuerelement dafür. Die
aktuelle Seite ist ein **zweiseitiges Binding** (`currentPage`).

## Wann einsetzen

- Seitennavigation unter eine [`ui-table`](ui-table.md) oder
  [`ui-list`](ui-list.md) setzen.
- Einen reaktiven Paging-Loop mit einem Params-Store und einer `ui-query` treiben.
- Für Endlos-/Streaming-Listen (keine diskreten Seiten) ist dieser Knoten
  ungeeignet.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor/in Pickern. | Freitext | `Pagination N` |
| **Parent Slot** (`mount`) | Slot, in den der Knoten mountet. Pflicht. | Mount-Pfad | — |
| **Current Page** (`currentPage`) | **Zweiseitiges** Binding auf die aktuelle Seitennummer (1-basiert). Liest die Live-Seite; der Seitenwechsel emittiert `pageChange` für den Write-back-Loop. Pflicht. | `state`, `store`, `query`, `routeParam`, `literal`, `reactive`, `msg`, `flow`, `global`, `jsonata`, `env` (Default-Typ `number`) | — |
| **Total** (`total`) | **Rein lesendes** Binding auf die Gesamt-Seitenzahl. Typisch aus einem `ui-query`-Ergebnis (z. B. `query:<path>.totalCount`). Pflicht. | wie Current Page | — |
| **Page Size** (`pageSize`) | Einträge pro Seite (Config-Number). | Zahl | — |
| **Info-Zeile** (`showInfo`) | `true` — rendert eine Info-Zeile „Seite X von Y" unterhalb der Controls (Klasse `.webapp-pagination-info`). Der kompakte „X / Y"-Label zwischen den Buttons ist davon unabhängig und immer sichtbar. | Checkbox | aus |
| **Events** (`events`) | Aktiviert den `pageChange`-Output-Port. | `pageChange` | keine |
| **Visible** / **Disabled** / **Color** | Basis-Felder. | — | — |

`Size` ist N/A (keine Größen-Stufen). Ein vestigiales `totalItems`-Binding und ein
vestigiales `variant`-Enum (`numbered`/`simple`) wurden **entfernt** (P252) — die
Seitenzahl kommt allein aus `total`, und keines der Felder rendert distinkt.
Legacy-Flows mit diesen Feldern deployen unverändert.

## Eingang

`ui-pagination` **hat einen Eingangs-Port**:

- **`msg.payload`** — setzt die aktuelle Seite direkt (Ganzzahl ≥ 1); das
  `currentPage`-Binding wird bei der nächsten Auflösung wieder führend.
- **`msg.ui.patch`** — überschreibt Felder (z. B. `showInfo`).
- **`msg.ui.component.op`** (`show`, `hide`) — schaltet die Controls.
- Nicht erkannte / fachfremde Messages werden **unverändert durchgereicht**.

## Ausgänge / Events

Wenn `pageChange` aktiviert ist, hat `ui-pagination` einen Output-Port:

| Event | Wann | `msg.ui`-Felder |
|---|---|---|
| `pageChange` | Nutzer wechselt die Seite | `event: "pageChange"`, `params.page` (die neue 1-basierte Seite), `clientId`, `sourceId`, `appId` |

**Zweiseitiges Write-back:** die Laufzeit schreibt den Store nicht selbst.
Verdrahte `pageChange` → `ui-store-action` (`set`) auf den Store, den das
`currentPage`-Binding liest; dann lädt `ui-query` (auf demselben Store) die
passenden Daten neu. Die angezeigte Seite ändert sich erst, wenn der Store
`currentPage` zurückspeist.

## Beispiele

### 1. Ein Pager mit Info-Zeile und Store-Write-back

Vor/Zurück-Controls über 5 Seiten, mit der „Seite X von Y"-Info-Zeile.
`currentPage` liest einen Store-Wert; `pageChange` schreibt die neue Seite zurück
— der zweiseitige Loop.

Flow-Datei: [`examples/guide/ui-pagination.json`](../../../../examples/guide/ui-pagination.json)

Import-Anleitung:

1. In Node-RED Menü (☰) → **Import**.
2. `examples/guide/ui-pagination.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guidePagination/` öffnen — der Pager rendert
   mit Info-Zeile; ein Klick auf Vor/Zurück emittiert `pageChange` und aktualisiert
   den Store.

## Verwandt

- [`ui-query`](ui-query.md) — Datenladen mit page/pageSize-Parametern
- [`ui-table`](ui-table.md) / [`ui-list`](ui-list.md) — der paginierte Inhalt
- [Displaying data](../guides/displaying-data.md) — der Query-Loop und Pagination
- Contract-Doc (intern, deutsch): `docs/nodes/navigation/ui-pagination.md`
