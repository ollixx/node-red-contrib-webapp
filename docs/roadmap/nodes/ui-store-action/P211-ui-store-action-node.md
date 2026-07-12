---
id: P211
node: ui-store-action
title: "neuer Knoten ui-store-action: typisierter Store-Mutations-Knoten (Op set/patch/delete/replace/reset), Referenz auf einen ui-store, hybrid mode reference|wire; Wert aus msg.payload; Path-Override; per-client"
epic: nodes/ui-store-action
findings:
  - "Owner (2026-07-12): 'ich vermisse gerade action knoten für store und query. Macht es nicht sinn, dafür eigene Action Knoten zu bauen, um query.refresh, store.reset, etc. auszulösen.' → 'einen knoten store-action, der alle actions bietet zum Store'."
  - "Owner (2026-07-12) zum Modus: 'Bislang waren wir hybrid unterwegs, also beides anbieten.' → mode reference|wire wie ui-action.targetMode."
  - "Kontext (ADR 0029): read bleibt ui-store-read (Getter, keine Action); store-action macht die Schreib-Ops. Vier-Datei-Muster, /node-red-node-Skill."
acceptance:
  - "Neuer Knoten `ui-store-action` registriert (nodes/webapp.js WEBAPP_NODE_TYPES + package.json node-red.nodes), 1 Input, 1 Output. Config: `store` (Referenz auf ui-store, Node-Picker Preset Stores), `op` (Select set|patch|delete|replace|reset), `path` (optional Sub-Pfad), `mode` (Select reference|wire), `parent` (App, required wie P205)."
  - "Op-Semantik entspricht ui-store (applyStoreOperation): set/patch an path, delete an path, replace = ganzes Slice, reset = Initialwert. `reset` ignoriert den Wert."
  - "Wert-Quelle: der zu schreibende Wert kommt aus `msg.payload` (bei set/patch/replace). Path-Override-Präzedenz wie ui-store-read: `msg.ui.store.path` › `msg.path` › config-`path`; leer = statePath-Root."
  - "mode=reference (browser/integration, gemessen): jede Input-Message wendet die Op DIREKT auf den referenzierten Store an — server-seitig, per-client über `msg.ui.clientId` (Scope-Regel wie Schreiben: client-only ohne clientId → server.store.scope-violation), löst SSE-Re-Render aus. KEIN Wire zum ui-store nötig. Beweis: nach einem `set`-Trigger zeigt ein an den Store gebundener View den neuen Wert live."
  - "mode=wire: der Knoten mutiert NICHT selbst, sondern EMITTIERT am Out-Port `msg.ui.store = { id:<storeId>, op, path, value }` (value aus payload); der Flow verdrahtet das an den ui-store. Beweis: emittierte Message trägt korrektes id/op/path/value."
  - "Doku: neue Spec docs/nodes/state/ui-store-action.md (jedes Feld: Typ/Default/Wirkung, Op-Enum, Path-Präzedenz, mode reference|wire, per-client/scope) + Abgrenzung zu ui-store (Input-Protokoll) und ui-store-read (Getter). Editor-HTML-Hilfe. Node-Test-Katalog tests/e2e/nodes/state/ui-store-action.tests.md."
verify: browser
spec: docs/nodes/state/ui-store-action.md
tests: tests/e2e/nodes/state/ui-store-action.tests.md
dependencies: []
status: pending
---
# P211 — neuer Knoten `ui-store-action` (typisierte Store-Mutation, hybrid)

> Entscheidung: [ADR 0029](../../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md).
> Vier-Datei-Muster — vor dem Lesen von Quellcode `/node-red-node` aufrufen.

## Kern

Referenz auf einen `ui-store` + Op-Selector. Zwei Modi (immer beide verfügbar):
- **reference:** wendet die Op **direkt** auf den Store an (per-client, SSE-Re-Render), kein Wire.
- **wire:** emittiert `msg.ui.store = {id,op,path,value}` am Out-Port zum Verdrahten.

`reset` ohne Wert; Wert sonst aus `msg.payload`; Path `msg.ui.store.path` › `msg.path` › config.

## acceptance / verify

- `verify: browser` — Orchestrator im Haupt-Checkout ([[orchestrator-must-verify-e2e-in-main-checkout]]):
  reference-mode mutiert den Store (gebundener View aktualisiert live, gemessen);
  wire-mode emittiert das korrekte Envelope. Beide Modi belegt.

## Risiken / Hinweise

- `parent` required (P205). Nicht mit `ui-store-read` (Getter) verwechseln.
- Sub-Pfad EINE Ebene relativ zum statePath (ADR 0013).
