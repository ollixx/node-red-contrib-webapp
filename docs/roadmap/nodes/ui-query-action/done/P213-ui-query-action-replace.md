---
id: P213
node: ui-query-action
title: "ui-query-action: action `replace` — eingehende Daten (msg.payload) als Query-Daten setzen (die Daten-rein-Seite zu `refresh`); reference|wire wie P212"
epic: nodes/ui-query-action
findings:
  - "Owner (2026-07-13): 'ui-query-action braucht noch ein replace für eingehende daten nach refresh.'"
  - "Kontext: P212 lieferte ui-query-action mit action `refresh` (Trigger raus). Der Loop braucht die symmetrische Daten-rein-Seite: nach dem refresh-getriggerten Fetch die Ergebnis-Liste typisiert in die Query schreiben, statt einer Function `msg.ui.query = {queryPath, data: payload}`."
acceptance:
  - "Schema/Editor: der action-Selector von ui-query-action erhält `replace` (Enum jetzt `refresh` | `replace`). Default bleibt `refresh`."
  - "reference-mode + action=replace: der Knoten setzt die Daten der referenzierten Query DIREKT — `msg.payload` (Array) wird zur Query-`data` (applyQueryMessage-Äquivalent an `ui.queries.<queryPath>`), per-client über `msg.ui.clientId`, mit SSE-Re-Render. Optional `totalCount`/`pageCount` aus `msg.ui.query.*` bzw. Konvention übernommen. Beweis: ein an `query:<path>` gebundener View zeigt nach dem replace die neuen Zeilen live."
  - "wire-mode + action=replace: der Knoten mutiert NICHT, sondern EMITTIERT `msg.ui.query = { queryPath, data: <payload>, ...(totalCount/pageCount falls vorhanden) }` am Out-Port zum Verdrahten an den ui-query-Input. Beweis: emittiertes Envelope trägt queryPath + data."
  - "Daten-Quelle: die zu setzenden Daten kommen aus `msg.payload`. Kein payload → leeres/kein data (dokumentiert)."
  - "Doku docs/nodes/state/ui-query-action.md + Katalog: `replace` beschrieben (Daten-rein-Seite, reference|wire, payload-Quelle, Abgrenzung zu `refresh`)."
verify: browser
spec: docs/nodes/state/ui-query-action.md
tests: tests/e2e/nodes/state/ui-query-action.tests.md
dependencies: [P212]
status: done
---
# P213 — ui-query-action `replace` (Daten-rein-Seite)

> Erweitert [P212](P212-ui-query-action-node.md) um die
> zweite Action. Vertrag: [ADR 0029](../../../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md).

## Kern

Zweite Action neben `refresh`: **`replace`** schreibt `msg.payload` als Query-Daten.
Damit ist der Loop typisiert:
```
[ui-query-action refresh] → Fetch → [ui-query-action replace • payload=Array] → Query-Binding
```
- reference: setzt `ui.queries.<queryPath>.data` direkt (per-client, SSE-Re-Render).
- wire: emittiert `msg.ui.query = {queryPath, data}`.

## acceptance / verify

- `verify: browser` — reference-mode: gebundener View zeigt die neuen Zeilen;
  wire-mode: korrektes `{queryPath, data}`-Envelope. Orchestrator im Haupt-Checkout
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- `replace` ist die typisierte Form von `msg.ui.query.data` (P160/applyQueryMessage);
  Terminal-Regel bleibt (data absorbiert die Query, kein Loop).

## Result

**Delivered.** Zweite Action `replace` (Daten-rein-Seite zu `refresh`) auf `ui-query-action` — rein additiv, hybrid `reference|wire`.
- **Schema** `packages/schema/src/node-definitions.ts`: `action`-Enum → `z.enum(["refresh","replace"])`, Default bleibt `refresh`. **Editor** `packages/editor/src/nodes.ts` (action-Union) + `nodes/state/ui-query-action.html` (`<option value="replace">` + Hilfe für beide Actions).
- **Runtime** `nodes/webapp.js`: neuer Helper `applyQueryDataDirect` (nutzt den bestehenden P160-`applyQueryMessage`-Fold — dieselbe Apply-Bahn wie `queryInputHandler`); `queryActionInputHandler` verzweigt nach `action`. `mapConfig` reichte `action` schon durch.
- **Spec** `docs/nodes/state/ui-query-action.md` + **Katalog** `tests/e2e/nodes/state/ui-query-action.tests.md` um `replace` erweitert.

**Semantik.** **reference+replace**: schreibt `msg.payload` direkt in `ui.queries.<queryPath>.data` (per-client via `msg.ui.clientId`, sonst Broadcast), SSE-Re-Render; Knoten emittiert nichts; `totalCount`/`pageCount` aus `msg.ui.query.*` übernommen. **wire+replace**: emittiert `msg.ui.query = {queryPath, data, totalCount?, pageCount?}`, mutiert nicht. **Kein payload → `data = []`** (expliziter Replace-auf-leer, Status `success` — dokumentiert; ein Payload-omit-No-op wurde als überraschend verworfen). **refresh** (P212) byte-genau erhalten (2 Regressionstests: refresh feuert weiter, schreibt nie Query-Daten). Terminal-Regel (data absorbiert, kein Loop) gilt.

**Verify (browser, gemessen — Haupt-Checkout).** `tests/e2e/nodes/state/ui-query-action-replace.spec.ts` **1 passed** (2.7s): wire → Envelope-Readout `{"queryPath":"items","data":[{"id":1,"name":"Ada"}]}`, Query-Readout bleibt leer (kein Mutieren); reference → Query-Readout füllt sich live mit `REPLACED` (Daten direkt, per-client SSE).

**Stats.** Unit grün: schema 486 (+1), runtime 1168 (+11 P213). `pnpm build`/`lint`/`check:specs` (42 Knoten)/`check:links`/`check:roadmap` grün. E2E P213-Spec grün.

**Cost.** Sub-Agent `phase/P213` (worktree), ~15 min (14:50:12Z→15:05:35Z); Token-Zeile in `.ai/agent-runs.jsonl`. (Worktree-Anomalie: stale base `db4f4ff` — Branch korrekt auf develop rebasiert, kein Datenverlust.)
