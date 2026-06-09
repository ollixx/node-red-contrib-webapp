---
id: P81
title: "Test-Infra: geteilter klassischer Knoten-Verhaltens-Test-Harness — Fixture, das einen registrierten Knoten-inputHandler treibt (msg-in), Output-Messages (send) UND SSE-Pushes erfasst; extrahiert aus den p59/p56/p30/p38-Mustern; + kurze Test-Konventionen-Doc (Verhalten=klassisch, E2E=Editor+Render)"
epic: aspects/test-infra
status: done
dependencies: [P47]
---
# P81 — Test-Infra: geteilter klassischer Knoten-Verhaltens-Test-Harness — Fixture, das einen registrierten Knoten-inputHandler treibt (msg-in), Output-Messages (send) UND SSE-Pushes erfasst; extrahiert aus den p59/p56/p30/p38-Mustern; + kurze Test-Konventionen-Doc (Verhalten=klassisch, E2E=Editor+Render)

## Result

**Delivered:** Shared classic node-behaviour test harness (NodeBehaviourHarness + makeFakeSseRes in packages/runtime/test/helpers/node-behaviour-harness.ts) that drives a registered node's real inputHandler (msg-in) and captures BOTH output messages (send) and SSE pushes (fake res), plus a dispatchClientEvent (P30 ingest) helper and the verb-table/factory re-exports; extracted from the p59/p56/p30/p38 patterns. Adds test-conventions.md (behaviour=classic, E2E=editor+render policy) and a 7-test self-test exercising real ui-dialog/ui-button nodes.

**Stats:** 3 new files (harness .ts, test-conventions.md, p81 self-test) + 1 friction-log line; +7 unit tests (385→392); 0 node types; the four source tests left unchanged.

**Notes:** Harness is the contract for P82–P86: they should drive behaviour via h.drive()/h.connectClient()/ h.dispatchClientEvent() and assert on parsed SSE frames + captured output messages, not re-derive webapp.__test__. Did NOT rewrite the existing p59/p56/p30/p38 tests (per brief — extract, don't rewrite); webappTest escape hatch is exposed for un-wrapped exports. Full validation green: pnpm validate (build+lint+392 unit+roadmap) and pnpm exec playwright test (297 passed) both ran clean in the worktree. No source/runtime/render/editor files touched — test infra only.


**Cost:** session a8a7cb4f01251c353, 9m
