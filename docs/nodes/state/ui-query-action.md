# ui-query-action

> **Status:** implementiert (P212, [ADR 0029](../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
> Vier-Datei-Muster: `nodes/state/ui-query-action.{js,html}`, Schema-Vertrag in
> `packages/schema` (`uiQueryActionNodeDefinitionSchema`), Registrierung + Runtime-
> Handler (`queryActionInputHandler`) in `nodes/webapp.js`. 1 Input, 1 Output.

Typisierter, referenz-basierter **Trigger-Knoten** für einen
[`ui-query`](ui-query.md): referenziert eine Query per ID und löst bei jedem
Input deren `refresh` aus — statt `msg.ui.query = {queryPath, refresh:true}` von
Hand zu bauen. Zwei Modi (immer beide verfügbar, `mode` spiegelt
`ui-action.targetMode`): **reference** feuert den Refresh direkt server-seitig
(`fireQueryRefresh`), **wire** emittiert das Refresh-Envelope zum Verdrahten.

## Felder

| Feld | Label | Editor-Typ | Pflicht | Beschreibung |
|---|---|---|---|---|
| `name` | „Name" | Textfeld | optional | Anzeigename im Editor (Default: „Query Action N"). Keine Laufzeit-Wirkung. |
| `query` | „Query" | Node-Picker (Preset Queries) | **ja** | Referenz auf die zu triggernde `ui-query` (Knoten-ID). Leer = nicht auflösbar → Laufzeit-Fehler. |
| `action` | „Action" | Select | **ja** | Die auszulösende State-Action. Heute nur `refresh` (Default). Erweiterbares Enum — der Selector ist so modelliert, dass weitere Werte ohne Bruch dazukommen. |
| `mode` | „Mode" | Select | **ja** | `reference` (direkt triggern) \| `wire` (Envelope emittieren). Default `reference`. |
| `parent` | „App" | Node-Picker (Apps) | **ja** | Besitzende `ui-app` (app-gebundener Referenz-Knoten, P205). Leer = Deploy-Fehler. |

## Action-Enum

| Wert | Wirkung |
|---|---|
| `refresh` | Löst den Refresh der referenzierten Query aus (Lifecycle → `loading`, Retrieval feuert). Einziger Wert heute; das Enum ist bewusst erweiterbar gehalten. |

## Modi

- **`reference`** (Default): jede Input-Message triggert den Refresh der
  referenzierten Query **direkt**, server-seitig, über `fireQueryRefresh` —
  per-client über `msg.ui.clientId`. Der Out-Port der **Query** (nicht dieses
  Knotens) feuert daraufhin die Retrieval-Message
  (`msg.ui.query = { queryPath, refresh:true, params? }`, plus `clientId` wenn
  gesetzt), und der Query-Lifecycle flippt auf `loading` (Snapshot-Push).
  **Kein Wire** zur `ui-query` nötig. Dieser Knoten selbst emittiert in
  `reference`-Mode nichts an seinem Out-Port.
- **`wire`**: der Knoten triggert **nicht**; er emittiert an seinem Out-Port
  `msg.ui.query = { queryPath, refresh:true, params }` (queryPath aus der
  referenzierten Query aufgelöst), das der Flow an den `ui-query`-Input
  verdrahtet, welcher den Refresh anwendet.

## Params-Quelle

Optionale Query-Params stammen aus `msg.ui.query.params` (Vorrang) oder
`msg.payload`. In `reference`-Mode werden sie an `fireQueryRefresh` weitergereicht
(und landen so im Retrieval-Envelope); in `wire`-Mode reisen sie im emittierten
Envelope mit. **Fehlt beides** (kein `msg.ui.query.params`, kein `msg.payload`),
wird **kein `params`-Feld** gesetzt — der Knoten emittiert nie
`params: undefined` oder `params: {}`, sondern lässt den Schlüssel weg.

Präzedenz: `msg.ui.query.params` › `msg.payload` › (keins = kein params-Feld).

## Per-Client

Mit `msg.ui.clientId` zielt der `reference`-Mode-Refresh auf den jeweiligen
Client (der Retrieval-Envelope trägt die `clientId` weiter, sodass der
verdrahtete Fetch beim Daten-Return denselben Client trifft, P15). Ohne clientId
ist der Refresh ein Broadcast.

## Fehler-Codes (beide Modi)

| Code | Auslöser |
|---|---|
| `server.query.action-missing-query` | referenzierte Query nicht im Registry gefunden (queryPath nicht auflösbar) — kein Send, `done(error)` |

## Output

```
// reference-Mode: dieser Knoten emittiert NICHTS an seinem Out-Port.
// Stattdessen feuert die referenzierte ui-query an IHREM Out-Port:
msg.ui.query = { queryPath, refresh: true, params? }   // (+ msg.ui.clientId wenn gesetzt)

// wire-Mode (dieser Knoten, an seinem Out-Port):
msg.ui.query = { queryPath, refresh: true, params? }
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
- `ui-query-action` — **triggert** einen Query-Refresh (dieser Knoten):
  typisierte Action-Auswahl, ohne `msg.ui.query` von Hand zu bauen. Symmetrisch
  zu [`ui-store-action`](ui-store-action.md) (typisierte Store-Mutation).
