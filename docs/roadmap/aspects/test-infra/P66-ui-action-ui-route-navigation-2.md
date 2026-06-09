---
id: P66
title: "ui-action/ui-route Navigation — 2 Szenarien (wired-route mit params / pfad-typedInput mit JSONata) + onEnter immer + Mehrdeutigkeits-Validierung + ui-app implizite Root-Route (gleiches Verhalten)"
epic: aspects/test-infra
status: done
dependencies: [P60]
---
# P66 — ui-action/ui-route Navigation — 2 Szenarien (wired-route mit params / pfad-typedInput mit JSONata) + onEnter immer + Mehrdeutigkeits-Validierung + ui-app implizite Root-Route (gleiches Verhalten)

## Result

**Delivered:** ui-action navigate redesigned (ADR 0007 Amendment): Scenario 1 (wired to a ui-route/ui-app — params fill the route's own path, no `to`) and Scenario 2 (`to` typedInput str/msg/flow/global/jsonata resolved app-global at the ui-app); onEnter/onLeave emitted on route entry/leave in BOTH scenarios; ui-app gains onEnter/onLeave for its implicit root route and treats a wired navigate-action like a ui-route (navigate to '/'); deploy-time cross-validation in webapp.js (ambiguous = wired AND `to` set / no-destination / dead static link to a non-existent route); ui-route and ui-app share one navigate code path (DRY).

**Stats:** 14 files changed (2 new tests) +782/-20; schema 152→159, runtime 276→294 (+18 P66 tests); ADR 0007 + ui-action.md + ui-app.md updated; new E2E p66-navigation.spec.ts. Plus follow-up P66-fix: typedInput-aware E2E helpers (tests/helpers/node-editor-page.ts) + behavior-state.spec.ts update.

**Notes:** `to`+`toType`+`params` added to schema/mapConfig; JSONata context is the full msg (RED.util.prepareJSONataExpression/evaluateJSONataExpression; msg/flow/global via evaluateNodeProperty). ADR 0007 extended with a P66 Amendment (not a new ADR). Renderer needed no change (runtime owns navigate; existing route-param resolution already covered). Latent ui-app.html bug fixed incidentally (registerNodeTypeWithEvents was called with no availableEvents). gen:example produced a byte-identical flow.json (new fields unused by the example). ORCHESTRATOR VERIFICATION: first post-merge E2E showed 6 stale-dist failures (dist is gitignored — must pnpm build after merge), then a deterministic behavior-state:17 regression because P66 made `to` a typedInput and that older test drove it as a plain input — fixed via phase/P66-fix (typedInput-aware helpers, no editor bug; editor persists the value correctly). The p12/p13/p15/parent-selector editor-registration failures seen transiently were PRE-EXISTING shared-server parallel-run flakiness (pass in isolation; clean on full re-run), not P66. Final full E2E on develop: 267 passed / 0 failed.


**Cost:** session ~28m (impl) + P66-fix session a088cefb6b3fe503a ~3m; orchestrator: merge + rebuild + full E2E (267) + diagnosis of stale-dist & flakiness
