# ui-query-action

Triggert einen `ui-query`-Refresh oder schreibt dessen Daten — typisiert, ohne
`msg.ui.query` von Hand zu bauen.

> English: [../../nodes/ui-query-action.md](../../nodes/ui-query-action.md)

## Zweck

`ui-query-action` ist ein typisierter, referenz-basierter Knoten für eine
[`ui-query`](ui-query.md): er referenziert eine Query per ID, und die **action**
wählt die Richtung — statt `msg.ui.query = {…}` von Hand zu bauen:

- **`refresh`** (Daten-raus): triggert bei jedem Input den Refresh der Query.
- **`replace`** (Daten-rein): schreibt eingehendes `msg.payload` als Query-Daten.

Zusammen bilden sie den typisierten Loop `refresh → Fetch → replace`. Zwei Modi:
**reference** wendet direkt server-seitig an; **wire** emittiert das Envelope
(siehe [Actions & Events](../guides/actions-events.md)).

## Wann einsetzen

- Den Fetch einer Query aus dem Flow anstoßen (`refresh`).
- Ein Fetch-Ergebnis direkt in eine Query schreiben (`replace`) — die typisierte
  Form von `msg.ui.query = { queryPath, data }`.
- **wire**-Mode, wenn du das Envelope im Flow willst, statt es anzuwenden.

## Felder

| Feld | Was es tut | Werte / Varianten | Default |
|---|---|---|---|
| **Name** | Anzeigename im Editor. | Freitext | `Query Action N` |
| **App** | Die besitzende `ui-app`. Pflicht. | App-Referenz | — |
| **Query** | Die zu triggernde `ui-query`, aus dem Query-Picker. Pflicht — leer ist ein Laufzeit-Fehler. | Query-Referenz | — |
| **Action** (`action`) | Richtung. `refresh` triggert die Query (Daten-raus); `replace` setzt die Daten der Query aus `msg.payload` (Daten-rein). | `refresh` / `replace` | `refresh` |
| **Mode** (`mode`) | `reference` wendet direkt server-seitig an; `wire` emittiert das Envelope. | `reference` / `wire` | `reference` |

## Action-Semantik

| Wert | Richtung | Wirkung |
|---|---|---|
| `refresh` | Daten-raus | löst den Refresh der referenzierten Query aus (Lifecycle → `loading`, Retrieval feuert) |
| `replace` | Daten-rein | setzt die Daten der Query aus `msg.payload` (Status `success`, `updatedAt` gesetzt) |

## Eingang

Jeder Input führt die Action aus. **`refresh`**-Params stammen aus
`msg.ui.query.params` › `msg.payload` (sonst kein `params`-Schlüssel).
**`replace`**-Daten kommen aus `msg.payload` (kein Payload → `data` ist `[]`);
optionale `totalCount`/`pageCount` werden übernommen, wenn auf `msg.ui.query.*`
vorhanden. `msg.ui.clientId` zielt auf einen Client. Fehler:
`server.query.action-missing-query` (Query nicht im Registry) — ein
`done(error)` ohne Send.

## Ausgänge / Events

```
// refresh, reference-Mode: dieser Knoten emittiert NICHTS — die referenzierte Query
// feuert an IHREM Out-Port: msg.ui.query = { queryPath, refresh: true, params? }
// refresh, wire-Mode (dieser Knoten): msg.ui.query = { queryPath, refresh: true, params? }

// replace, reference-Mode: dieser Knoten emittiert NICHTS — ui.queries.<queryPath>.data wird gesetzt (SSE-Re-Render)
// replace, wire-Mode (dieser Knoten): msg.ui.query = { queryPath, data, totalCount?, pageCount? }
```

## Beispiele

### 1. Query-Daten mit `replace` schreiben (reference-Mode)

Ein Inject-Payload wird per `replace` in eine Query geschrieben; ein an die Query
gebundener `ui-text` zeigt ihn live.

Flow-Datei: [`examples/guide/ui-query-action.json`](../../../../examples/guide/ui-query-action.json)

Import-Anleitung:

1. In Node-RED das Menü (☰) → **Import** öffnen.
2. `examples/guide/ui-query-action.json` wählen (oder JSON einfügen) → **Import**.
3. **Deploy** klicken.
4. `http://<dein-node-red>:1880/webapp/guideQueryAction/` öffnen und das Inject
   klicken — die Query-Zeile zeigt „Replaced via ui-query-action".

## Verwandt

- [`ui-query`](ui-query.md) — die getriggerte / befüllte Query
- [Displaying data](../guides/displaying-data.md) — die Query-Schleife
- [Actions & Events](../guides/actions-events.md) — Wire vs. Referenz
- Contract-Doc (intern, Deutsch): `docs/nodes/state/ui-query-action.md`
