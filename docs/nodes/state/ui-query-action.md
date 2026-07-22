# ui-query-action

> **Status:** implementiert (P212 + P213, [ADR 0029](../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
> Vier-Datei-Muster: `nodes/state/ui-query-action.{js,html}`, Schema-Vertrag in
> `packages/schema` (`uiQueryActionNodeDefinitionSchema`), Registrierung + Runtime-
> Handler (`queryActionInputHandler`) in `nodes/webapp.js`. 1 Input, 1 Output.

Typisierter, referenz-basierter Knoten für einen [`ui-query`](ui-query.md):
referenziert eine Query per ID. Die **`action`** wählt die Richtung — statt
`msg.ui.query = {…}` von Hand zu bauen:

- **`refresh`** (P212, Daten-raus): löst bei jedem Input den `refresh` der Query aus.
- **`replace`** (P213, Daten-rein): schreibt eingehendes `msg.payload` als
  Query-Daten (`ui.queries.<queryPath>.data`) — die typisierte Form von
  `msg.ui.query = {queryPath, data}`.

Zusammen bilden sie den typisierten Loop:
```
[ui-query-action refresh] → Fetch → [ui-query-action replace • payload=Zeilen] → query:<path>-Binding
```

Zwei Modi (immer beide verfügbar, `mode` spiegelt `ui-action.targetMode`):
**reference** wendet direkt server-seitig an, **wire** emittiert das Envelope zum
Verdrahten.

## Felder

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor (Default: „Query Action N"). Keine Laufzeit-Wirkung. |
| `query` | „Query" | Node-Picker (Preset Queries) | **ja** | Referenz auf die zu triggernde `ui-query` (Knoten-ID). Leer = nicht auflösbar → Laufzeit-Fehler. |
| `action` | „Action" | Select | **ja** | Richtung: `refresh` (Query triggern, Default) \| `replace` (Query-Daten aus `msg.payload` setzen). Erweiterbares Enum. |
| `mode` | „Mode" | Select | **ja** | `reference` (direkt triggern) \| `wire` (Envelope emittieren). Default `reference`. |
| `app` | „App" | Node-Picker (Apps) | **ja** | Besitzende `ui-app` (app-gebundener Referenz-Knoten, P205). Leer = Deploy-Fehler. |

## Action-Enum

| Wert | Richtung | Wirkung |
|---|---|---|
| `refresh` | Daten-raus (P212) | Löst den Refresh der referenzierten Query aus (Lifecycle → `loading`, Retrieval feuert). Default. |
| `replace` | Daten-rein (P213) | Setzt die Daten der referenzierten Query aus `msg.payload` (`ui.queries.<queryPath>.data`, Status `success`) — die typisierte Form von `msg.ui.query.data`. |

Das Enum ist bewusst erweiterbar gehalten.

## action = refresh (Daten-raus, P212)

- **`reference`** (Default): jede Input-Message triggert den Refresh der
  referenzierten Query **direkt**, server-seitig, über `fireQueryRefresh` —
  per-client über `msg.ui.clientId`. Der Out-Port der **Query** (nicht dieses
  Knotens) feuert daraufhin die Retrieval-Message
  (`msg.ui.query = { queryPath, refresh:true, params? }`, plus `clientId` wenn
  gesetzt), und der Query-Lifecycle flippt auf `loading` (Snapshot-Push).
  **Kein Wire** zur `ui-query` nötig. Dieser Knoten emittiert in `reference`-Mode
  nichts.
- **`wire`**: der Knoten triggert **nicht**; er emittiert an seinem Out-Port
  `msg.ui.query = { queryPath, refresh:true, params }` (queryPath aus der
  referenzierten Query aufgelöst), das der Flow an den `ui-query`-Input
  verdrahtet, welcher den Refresh anwendet.

**Params-Quelle:** optionale Query-Params stammen aus `msg.ui.query.params`
(Vorrang) oder `msg.payload`. **Fehlt beides**, wird **kein `params`-Feld**
gesetzt — nie `params: undefined`/`params: {}`, sondern der Schlüssel entfällt.
Präzedenz: `msg.ui.query.params` › `msg.payload` › (keins = kein params-Feld).

## action = replace (Daten-rein, P213)

- **`reference`** (Default): der Knoten schreibt `msg.payload` (ein Array) **direkt**
  in die Query-Daten — `applyQueryMessage`-Äquivalent an `ui.queries.<queryPath>`,
  Status `success`, `updatedAt` gesetzt — per-client über `msg.ui.clientId`
  (sonst Broadcast-State), mit **SSE-Re-Render** (`pushSnapshotToClients`). Jeder
  an `query:<path>` gebundene View zeigt die neuen Zeilen live. Es ist **dieselbe
  Apply-Bahn** wie der verdrahtete Daten-Return im `ui-query`-Input-Handler
  (P160); die Terminal-Regel bleibt (Daten werden absorbiert, kein Loop). Dieser
  Knoten emittiert in `reference`-Mode nichts.
- **`wire`**: der Knoten mutiert **nicht**; er emittiert an seinem Out-Port
  `msg.ui.query = { queryPath, data, totalCount?, pageCount? }`, das der Flow an
  den `ui-query`-Input verdrahtet (dessen Input-Handler die Daten anwendet und
  absorbiert — terminal, kein Loop).

**Daten-Quelle:** die zu setzenden Daten kommen aus `msg.payload`. **Kein payload**
(`undefined`/`null`) → `data` ist `[]` (ein expliziter Replace-auf-leer; `replace`
schreibt immer ein Daten-Envelope). Optionale `totalCount`/`pageCount` werden
übernommen, wenn sie auf `msg.ui.query.*` vorhanden sind (dieselbe Paging-Konvention
wie P161).

## Per-Client

Mit `msg.ui.clientId` zielt der `reference`-Mode auf den jeweiligen Client: bei
`refresh` trägt der Retrieval-Envelope die `clientId` weiter (P15); bei `replace`
landet der Daten-Schreibvorgang im per-client State. Ohne `clientId` ist die
Wirkung ein Broadcast.

## Fehler-Codes (beide Modi, beide Actions)

| Code | Auslöser |
|---|---|
| `server.query.action-missing-query` | referenzierte Query nicht im Registry gefunden (queryPath nicht auflösbar) — kein Send, `done(error)`. `op` ist `query:refresh` bzw. `query:replace`. |

## Output

```
// action=refresh, reference-Mode: dieser Knoten emittiert NICHTS an seinem Out-Port.
// Stattdessen feuert die referenzierte ui-query an IHREM Out-Port:
msg.ui.query = { queryPath, refresh: true, params? }   // (+ msg.ui.clientId wenn gesetzt)

// action=refresh, wire-Mode (dieser Knoten, an seinem Out-Port):
msg.ui.query = { queryPath, refresh: true, params? }

// action=replace, reference-Mode: dieser Knoten emittiert NICHTS.
// Stattdessen wird ui.queries.<queryPath>.data direkt gesetzt (SSE-Re-Render).

// action=replace, wire-Mode (dieser Knoten, an seinem Out-Port):
msg.ui.query = { queryPath, data, totalCount?, pageCount? }
```

## Abgrenzung

- [`ui-query`](ui-query.md) — **hält** die Query: refresht über ihr eigenes
  Input-Protokoll (`msg.ui.query = {queryPath, refresh:true}`) und emittiert am
  Out-Port den Retrieval-Trigger. Der `wire`-Mode dieses Knotens speist genau
  dieses Input-Protokoll.
- **`ui-query.refreshAction`** ist etwas anderes: das ist eine
  **UI-Action-Referenz IN der Query** (welche UI-Action deren Refresh auslöst),
  NICHT dieser eigenständige Trigger-Knoten. `ui-query-action` ist ein separater
  Knoten, der von außen (per Referenz oder Wire) einen Query-Refresh anstößt.
- `ui-query-action` — **triggert** (`refresh`) ODER **setzt Daten** (`replace`)
  einer Query, ohne `msg.ui.query` von Hand zu bauen. Symmetrisch zu
  [`ui-store-action`](ui-store-action.md) (typisierte Store-Mutation).
- **`refresh` vs. `replace`:** `refresh` ist die Daten-**raus**-Seite (stößt das
  Retrieval an), `replace` die Daten-**rein**-Seite (schreibt das Ergebnis zurück).
  In einem Fetch-Loop feuert `refresh` den Fetch, `replace` schreibt dessen
  Ergebnis-Array in die Query — `replace` ersetzt so die Function
  `msg.ui.query = {queryPath, data: payload}`.
