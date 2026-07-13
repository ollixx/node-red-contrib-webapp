# ui-query-action — Test-Katalog

Tests für den typisierten Query-Trigger-Knoten [`ui-query-action`](../../../../docs/nodes/state/ui-query-action.md)
(P212, [ADR 0029](../../../../docs/adr/0029-state-action-nodes-store-action-query-action-hybrid.md)).
Outcome-basiert nach `.ai/agents/node-testing.md`: beide Modi, die Params-Quelle
(`msg.ui.query.params` › `msg.payload`, sonst weggelassen) und der
Unbekannte-Query-Fehler werden gegen den echten Runtime-Handler bzw. im Browser
über den **gemessenen gerenderten Effekt** geprüft — nie über DOM-Präsenz/Tags.

## Unit — Schema (`packages/schema/test/p212-query-action-schema.test.ts`)

| Test | Ziel |
|---|---|
| minimal + Defaults | `action` default `refresh`, `mode` default `reference` |
| action=refresh | der (heute einzige) gültige Action-Wert wird akzeptiert |
| mode=reference/wire | beide Modi werden akzeptiert |
| unbekannte action (`reset`) | wird abgelehnt (Enum erweiterbar, aber geschlossen) |
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
