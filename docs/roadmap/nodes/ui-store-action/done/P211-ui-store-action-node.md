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
status: done
---
# P211 — neuer Knoten `ui-store-action` (typisierte Store-Mutation, hybrid)

> Entscheidung: [ADR 0029](../../../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md).
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

## Result

**Delivered.** Neuer Knoten `ui-store-action` (Vier-Datei-Muster) — typisierte Store-Mutation, hybrid `reference|wire`.
- **Schema** `packages/schema/src/node-definitions.ts` + `index.ts`: `uiStoreActionNodeDefinitionSchema` (`store` req, `op` enum `set|patch|delete|replace|reset` default `set`, optional `path`, `mode` enum `reference|wire` default `reference`), in Union + Type-Map + Exports.
- **Runtime** `nodes/webapp.js`: `storeActionInputHandler` + Registry-Eintrag; `ui-store-action` in `WEBAPP_NODE_TYPES` **und** `APP_SCOPED_PARENT_TYPES` (P205 deploy-validiert).
- **Editor** `nodes/state/ui-store-action.{js,html}` (native op/mode-Selects, `installParentAppSelector` + `installReferenceSelectors({store})`, Inline-Hilfe); `packages/editor/src/nodes.ts` Config-Typ + `nodeSet`. `package.json` `node-red.nodes` registriert.
- **Spec** `docs/nodes/state/ui-store-action.md` (Feld-für-Feld, Op-Enum, Path-Präzedenz, beide Modi, per-client/Scope, Fehlercodes, Abgrenzung zu `ui-store`/`ui-store-read`). **Test-Katalog** `tests/e2e/nodes/state/ui-store-action.tests.md`.

**Semantik.** Ops über den geteilten `applyStoreOperation` (set/patch an path, delete an path, replace = ganzes Slice, reset = Initialwert, payload ignoriert). Wert aus `msg.payload`; Path-Präzedenz `msg.ui.store.path` › `msg.path` › config, leer = statePath-Root. **reference**: mutiert direkt server-seitig, per-client via `msg.ui.clientId` (Scope-Regel → `server.store.scope-violation`), persistiert + `pushSnapshotToClients` + Query-Refresh + `changed`-Notification, kein Wire. **wire**: emittiert `msg.ui.store = {id, op, path, value}`, mutiert NICHT.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/state/ui-store-action.spec.ts` **1 passed** (2.9s): reference-mode → an den Store gebundener Text `A`→`B` live (kein Wire); wire-mode → Result-Text zeigt `{"id":…,"op":"set","path":"name","value":"C"}` und der Entity-Text bleibt `B` (kein Mutieren).

**Stats.** Unit grün: schema 475 (+15 P211), editor 176, renderer 148, runtime 1143 (+21 P211, P205 +2). `pnpm build`/`lint`/`check:specs` (41 Knoten)/`check:links`/`check:roadmap` grün. E2E P211-Spec grün.

**Cost.** Sub-Agent `phase/P211` (worktree), ~17 min (18:05:58Z→18:23:05Z), session `d58245ce…`; Token-Zeile in `.ai/agent-runs.jsonl`.
