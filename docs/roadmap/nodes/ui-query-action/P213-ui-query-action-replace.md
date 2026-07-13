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
status: in_progress
---
# P213 — ui-query-action `replace` (Daten-rein-Seite)

> Erweitert [P212](../ui-query-action/done/P212-ui-query-action-node.md) um die
> zweite Action. Vertrag: [ADR 0029](../../../adr/0029-state-action-nodes-store-action-query-action-hybrid.md).

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
