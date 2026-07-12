---
id: P212
node: ui-query-action
title: "neuer Knoten ui-query-action: typisierter Query-Trigger (action refresh), Referenz auf einen ui-query, hybrid mode reference|wire; optional Params aus msg.payload"
epic: nodes/ui-query-action
findings:
  - "Owner (2026-07-12): '… und einen query-action' — dedizierter Action-Knoten, um query.refresh auszulösen (statt Boilerplate-Function msg.ui.query={queryPath,refresh:true})."
  - "Owner (2026-07-12) zum Modus: 'Bislang waren wir hybrid unterwegs, also beides anbieten.' → mode reference|wire wie ui-action.targetMode."
  - "Kontext (ADR 0029): der einzige Query-Action-Wert heute ist refresh; der Selector ist erweiterbar. Vier-Datei-Muster, /node-red-node-Skill."
acceptance:
  - "Neuer Knoten `ui-query-action` registriert (nodes/webapp.js WEBAPP_NODE_TYPES + package.json node-red.nodes), 1 Input, 1 Output. Config: `query` (Referenz auf ui-query, Node-Picker Preset Queries), `action` (Select refresh; erweiterbar), `mode` (Select reference|wire), `parent` (App, required wie P205)."
  - "mode=reference (browser/integration, gemessen): jede Input-Message triggert den Refresh der referenzierten Query DIREKT (fireQueryRefresh) → deren Out-Port feuert den Retrieval; per-client über `msg.ui.clientId`. KEIN Wire zur Query nötig. Beweis: der an die Query gebundene Retrieval-Flow läuft nach dem Trigger."
  - "mode=wire: der Knoten triggert NICHT selbst, sondern EMITTIERT am Out-Port `msg.ui.query = { queryPath:<queryPath>, refresh:true, params }`; der Flow verdrahtet das an den ui-query-Input. Beweis: emittierte Message trägt korrektes queryPath + refresh:true."
  - "Params: optional werden Query-Params aus `msg.payload` (bzw. `msg.ui.query.params`) an die Query weitergereicht (reference: an fireQueryRefresh; wire: im Envelope). Fehlt payload → kein params-Feld."
  - "Doku: neue Spec docs/nodes/state/ui-query-action.md (Felder, action-Enum, mode reference|wire, params, per-client) + Abgrenzung zu ui-query (Input-Protokoll/refreshAction). Editor-HTML-Hilfe. Node-Test-Katalog tests/e2e/nodes/state/ui-query-action.tests.md."
verify: browser
spec: docs/nodes/state/ui-query-action.md
tests: tests/e2e/nodes/state/ui-query-action.tests.md
dependencies: []
status: in_progress
---
# P212 — neuer Knoten `ui-query-action` (typisierter Query-Trigger, hybrid)

> Entscheidung: [ADR 0029](../../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md).
> Vier-Datei-Muster — vor dem Lesen von Quellcode `/node-red-node` aufrufen.

## Kern

Referenz auf einen `ui-query` + Action-Selector (`refresh`). Zwei Modi:
- **reference:** triggert die Query **direkt** (`fireQueryRefresh`) → Out-Port feuert den Retrieval, kein Wire.
- **wire:** emittiert `msg.ui.query = {queryPath, refresh:true, params}` am Out-Port zum Verdrahten.

Optional Params aus `msg.payload`.

## acceptance / verify

- `verify: browser` — Orchestrator im Haupt-Checkout ([[orchestrator-must-verify-e2e-in-main-checkout]]):
  reference-mode → Retrieval-Flow läuft nach dem Trigger (gemessen); wire-mode →
  korrektes `{queryPath, refresh:true}`-Envelope. Beide Modi belegt.

## Risiken / Hinweise

- `parent` required (P205). Nicht mit `ui-query.refreshAction` verwechseln (das ist
  eine UI-Action-Referenz IN der Query; dieser Knoten ist ein eigenständiger Trigger).
