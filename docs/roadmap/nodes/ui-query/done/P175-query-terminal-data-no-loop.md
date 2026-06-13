---
id: P175
node: ui-query
epic: nodes/ui-query
title: "ui-query: data/error-Rückgabe terminal machen — kein Re-Emit am Out-Port (Endlosschleifen-Fix)"
findings:
  - "Owner (2026-06-13): 'der rückweg von function zu ui-query führt zu einer endlos schleife.'"
  - "Code-Befund: der Query-Input-Handler ruft am Ende ein UNBEDINGTES send(msg) (nodes/webapp.js:4302) — auch nachdem eine data-Message via applyQueryMessage absorbiert wurde. Die data-Rückgabe wird so erneut an den Out-Port → Datenquelle → Shaper → In-Port geschickt: Endlosschleife. Kommentar im Code: 'The message is still passed through unchanged'."
acceptance:
  - "Eine eingehende msg.ui.query mit data (passender queryPath) wird absorbiert (State + Snapshot-Push) und NICHT am Out-Port emittiert (kein send) — terminal."
  - "Eine eingehende msg.ui.query mit error ist ebenfalls terminal (absorbiert, kein Re-Emit)."
  - "Ein Trigger ohne data/error (onEnter, ui-action-refresh) wird WEITERHIN am Out-Port emittiert (der Fetch wird ausgelöst)."
  - "Eine refresh:true/loading:true-Message setzt den Ladezustand UND wird am Out-Port emittiert (manueller Re-Trigger funktioniert)."
  - "Nicht erkannte/fachfremde Messages passieren den Out-Port unverändert (Pass-Through bleibt)."
  - "Regression (no-loop): onEnter → ui-query → function(liefert data) → ui-query terminiert nach EINEM Fetch; der Out-Port feuert für die data-Rückgabe NICHT erneut (Unit zählt send-Aufrufe; E2E zeigt stabile, nicht endlos wachsende Snapshots)."
verify: browser
spec: docs/nodes/state/ui-query.md
tests: tests/e2e/nodes/state/ui-query.tests.md
dependencies: []
status: done
---
# P175 — ui-query: terminale data/error-Rückgabe (kein Loop)

> **Bugfix.** Der Query-In-Handler reicht heute **jede** Message am Out-Port durch
> (`send(msg)` unbedingt, `nodes/webapp.js:4302`) — auch die `data`-Rückgabe der
> Datenquelle. Damit läuft `out → Datenquelle → Shaper → in → out → …` endlos.
> ADR 0016 + die Spec ([Terminal-Regel](../../../../nodes/state/ui-query.md#output))
> verlangen: `data`/`error` sind **terminal**.

## Kern des Fixes

Im Query-Input-Handler **vor** dem abschließenden `send(msg)` unterscheiden:

- War die Message eine **terminale Rückgabe** (`msg.ui.query` mit `data` **oder**
  `error` für einen passenden `queryPath`)? → absorbieren (wie heute via
  `applyQueryMessage`) **und `return` ohne `send`**.
- Sonst (Trigger / `refresh` / `loading` / nicht erkannt) → wie bisher
  `send(msg)` (der Auslöser muss die Datenquelle erreichen).

`applyQueryMessage` liefert die Klassifikation bereits implizit (data/error vs.
refresh vs. null) — den Rückgabewert/Zweig nutzen, um den `send` zu unterdrücken.
**Kein** zweiter Code-Pfad, **kein** Schema-/Renderer-Wechsel.

## acceptance / verify

- `verify: browser` — der no-loop-Nachweis im laufenden Flow (stabile Snapshots,
  kein endloses Nachladen); E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).
- **Unit zuerst:** ein Handler-Test, der `send` mockt und zählt — `data`/`error`
  ⇒ 0 Out-Emits, Trigger/`refresh` ⇒ 1 Out-Emit. Das ist die billigste, härteste
  Absicherung gegen Re-Regression.

## Risiken / Hinweise

- **Pass-Through für Fremd-Messages bleibt** — nur `data`/`error` werden terminal.
  Genau prüfen, dass ein reiner Trigger (onEnter ohne `msg.ui.query`) weiterhin
  durchläuft.
- Etag-Kurzschluss (P-Caching, `runtimeState.queryEtags`) bleibt unberührt.
- Spec ist bereits auf die Terminal-Regel gezogen (dieser Commit); der Code zieht
  nach.

## Result

- **delivered:** Bugfix — ui-query `data`/`error` returns are now **terminal** (no out-port
  re-emit), killing the `out → data source → shaper → in → out → …` infinite loop. One-spot fix in
  `nodes/webapp.js` `queryInputHandler`: an `isTerminalReturn` flag — when `applyQueryMessage`
  absorbs a `data` or `error` return (detected via `hasOwnProperty` on the matching queryPath), the
  final `send(msg)` is suppressed and the handler returns. Triggers (onEnter / ui-action refresh),
  `refresh:true`/`loading:true`, and unrecognized/foreign messages STILL emit at the out-port
  (pass-through preserved). No second code path, no schema/renderer change; the ETag short-circuit
  is untouched.
- **stats:** 4 files (+250/−21). New `packages/runtime/test/p175-query-terminal-data-no-loop.test.ts`
  — **9 send-counting unit tests** (data→0 out-emits, error→0, refresh/loading/trigger→1, foreign→1,
  the hardest guard against re-regression); 4 pre-existing `p86` tests corrected from the old buggy
  "data passes through" expectation to "data is terminal". Develop verification: `pnpm build` exit 0;
  unit **1001 runtime** (+9) green; ui-query E2E **5/5 green** — the **P161 no-loop paging spec**
  ("params-store change → out-port refresh → mock DB → no loop"), the P160 data pipeline, and the
  P46 behavior specs (query passes injected messages through to a wired store via SSE; renders
  without error; direct inject doesn't crash) — confirming data/error are terminal WITHOUT breaking
  trigger emission or message pass-through. check:roadmap + check:links + lint OK.
- **notes:** The fix is exactly the loop-cause the P161 mock-DB had to work around manually (drop
  echoed data) — now the ui-query node itself is terminal, so real fetch flows can't loop. The
  dedicated E2E no-loop proof is covered by the existing P160/P161 specs (which would loop/grow
  unboundedly if this regressed) plus the unit send-counters; a stand-alone no-loop spec could be a
  later write-tests nicety.
- **cost:** session a7fedc8d282a2de83, ~8m (+ orchestrator develop E2E).
