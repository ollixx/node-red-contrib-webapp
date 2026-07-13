# ui-query-action — Test-Katalog

Tests für den typisierten Query-Knoten [`ui-query-action`](../../../../docs/nodes/state/ui-query-action.md)
(P212 `refresh` + P213 `replace`, [ADR 0029](../../../../docs/adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
Outcome-basiert nach `.ai/agents/node-testing.md`: beide Actions (`refresh` =
Daten-raus, `replace` = Daten-rein), beide Modi (`reference`|`wire`), die
Params-/Daten-Quelle und der Unbekannte-Query-Fehler werden gegen den echten
Runtime-Handler bzw. im Browser über den **gemessenen gerenderten Effekt**
geprüft — nie über DOM-Präsenz/Tags.

## Unit — Schema (`packages/schema/test/p212-query-action-schema.test.ts`)

| Test | Ziel |
|---|---|
| minimal + Defaults | `action` default `refresh`, `mode` default `reference` |
| action=refresh | der Action-Wert `refresh` wird akzeptiert |
| **action=replace** (P213) | der Action-Wert `replace` wird akzeptiert, `data.action === "replace"` |
| mode=reference/wire | beide Modi werden akzeptiert |
| unbekannte action (`reset`) | wird abgelehnt (Enum erweiterbar, aber geschlossen: nur `refresh`\|`replace`) |
| unbekannter mode | wird abgelehnt |
| fehlende `query`-Referenz | wird abgelehnt (Pflichtfeld) |
| leere `query`-Referenz | wird abgelehnt |
| direkter Parse über das exportierte Schema | akzeptiert `wire`-Variante |
| Dispatch | über die diskriminierte Union als `ui-query-action` erreichbar |

## Unit — Runtime-Handler (`packages/runtime/test/p212-query-action-node.test.ts`)

| Test | Ziel |
|---|---|
| mapConfig Defaults / Werte | `action`/`mode` korrekt gemappt; unbekanntes mode → reference |
| **wire**: Envelope | emittiert `{ queryPath, refresh:true, params }` (params aus payload), **triggert nicht** (query-`send` nie gerufen) |
| **wire**: Params-Weglassen | ohne payload/`msg.ui.query.params` fehlt der `params`-Schlüssel |
| **wire**: Params-Präzedenz | `msg.ui.query.params` gewinnt über `msg.payload` im Envelope |
| **reference**: Trigger | feuert den Refresh der referenzierten Query auf **deren** Out-Port (via distinktem nodeId aufgelöst), trägt `queryPath` + `params`; der Action-Knoten selbst emittiert nichts |
| **reference**: per-client | `msg.ui.clientId` wird auf den Refresh übernommen |
| **reference**: Params-Weglassen | ohne payload/`msg.ui.query.params` fehlt der `params`-Schlüssel |
| **reference**: Params-Präzedenz | `msg.ui.query.params` gewinnt über `msg.payload` |
| unbekannte Query (reference) | `server.query.action-missing-query`, kein send, `done(error)` |
| unbekannte Query (wire) | ebenso Fehler — `queryPath` ist nicht auflösbar |

## Unit — Runtime-Handler `replace` (`packages/runtime/test/p213-query-action-replace.test.ts`)

| Test | Ziel |
|---|---|
| mapConfig action=replace | `action`/`mode` korrekt gemappt |
| **reference**: Broadcast-Daten | `msg.payload` landet in `ui.queries.items.data`, Status `success`; Knoten emittiert nichts; triggert die Query nicht |
| **reference**: per-client | mit `msg.ui.clientId` in den per-client State geschrieben, Broadcast-State unberührt |
| **reference**: totalCount/pageCount | aus `msg.ui.query.*` ins Envelope übernommen |
| **reference**: kein payload | `data` wird `[]` (expliziter Replace-auf-leer), Status `success` |
| **wire**: Envelope | emittiert `{ queryPath, data }` aus payload, **mutiert nicht** (liveState/clientState leer) |
| **wire**: totalCount/pageCount | im emittierten Envelope durchgereicht |
| **wire**: kein payload | emittiert `data: []` |
| unbekannte Query (replace) | `server.query.action-missing-query`, kein send, `done(error)`, kein State geschrieben (`op = query:replace`) |
| **Regression** refresh (reference) | `refresh` feuert weiterhin den Query-Refresh, schreibt KEINE Query-Daten |
| **Regression** refresh (wire) | `refresh` emittiert weiterhin das Refresh-Envelope (kein `data`-Feld) |

## Unit — App-Scope-Parent (`packages/runtime/test/p205-app-scoped-parent-validation.test.ts`)

| Test | Ziel |
|---|---|
| ui-query-action ohne parent | Deploy-Fehler (P205), `no App parent` |
| „applies to ALL app-scoped types" | ui-query-action ist Teil der app-gebundenen Typen |

## E2E — Playwright (`tests/e2e/nodes/state/ui-query-action.spec.ts`)

Fixture: `tests/e2e/fixtures/p212-query-action.flow.json`. Eine `ui-query` `items`,
deren Out-Port an einen Retrieval-Provider verdrahtet ist (liefert `data:"LOADED"`
in die Query zurück — die echte refresh→retrieve→persist-Pipeline). Ein an
`query:items` gebundener Text zeigt die abgerufenen Daten; ein zweiter Text zeigt
das Wire-Envelope. Zwei Trigger (beide tragen die Browser-clientId).

| Test | Ziel (gemessener Effekt) |
|---|---|
| **wire mode** Envelope | nach WIRE zeigt der Envelope-Readout `{"queryPath":"items","refresh":true,"params":{"page":2}}` |
| **wire mode** triggert nicht | nach WIRE bleibt der Query-Readout NICHT `LOADED` (kein Retrieval ausgelöst) |
| **reference mode** triggert live | nach REFRESH füllt sich der Query-Readout mit `LOADED` (Retrieval-Pipeline lief nach dem Trigger, **kein** Wire vom Action-Knoten) |

## E2E — Playwright `replace` (`tests/e2e/nodes/state/ui-query-action-replace.spec.ts`)

Fixture: `tests/e2e/fixtures/p213-query-action-replace.flow.json`. Eine `ui-query`
`items` (ohne verdrahtetes Retrieval — `replace` setzt die Daten direkt). Ein an
`query:items` gebundener Text zeigt die Query-Daten; ein zweiter Text zeigt das
Wire-Envelope. Zwei Trigger (beide tragen die Browser-clientId).

| Test | Ziel (gemessener Effekt) |
|---|---|
| **wire mode** Envelope | nach REPLACE-WIRE zeigt der Envelope-Readout `{"queryPath":"items","data":[{"id":1,"name":"Ada"}]}` |
| **wire mode** mutiert nicht | nach REPLACE-WIRE bleibt der Query-Readout leer (kein `REPLACED`) — Wire schreibt den Query-State nicht |
| **reference mode** setzt Daten live | nach REPLACE-REF füllt sich der Query-Readout mit `REPLACED` (Daten direkt gesetzt, per-client SSE-Re-Render, **kein** Wire) |
