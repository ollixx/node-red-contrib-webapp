---
id: P61
title: "ui-app — Fehler-Weiterleitung als einzelne 'Logging'-Select + Info-Icon-Dialog"
epic: nodes/ui-app
status: done
dependencies: [P57]
node: ui-app
spec: docs/nodes/structure/ui-app.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P61 — ui-app — Fehler-Weiterleitung als einzelne 'Logging'-Select + Info-Icon-Dialog

## Result

**Delivered:** Replaced ui-app's verbose 3-element error-forwarding UI (checkbox + permanent form-tips block + conditional 'Min. Stufe' select + updateForwardVisibility) with ONE 'Logging' select (aus/debug/info/warn/error, default 'aus') plus a small fa-info-circle button opening a jQuery-UI explainer dialog (same pattern as the existing token dialog). Pure EDITOR mapping in oneditprepare/oneditsave onto the two unchanged config fields: 'aus' → forwardErrorsToClient=false; any severity → forwardErrorsToClient=true + forwardErrorMinSeverity=<value>. Schema (packages/schema) and runtime (nodes/webapp.js) UNCHANGED; secure default preserved.

**Stats:** nodes/structure/ui-app.html only (+ new tests/e2e/nodes/editor/ui-app-logging.spec.ts, 6 tests). E2E 258 passed / 0 failed; pnpm validate green. No diff in examples/customers-crud/flow.json (fields optional, not generator-emitted).

**Notes:** Editor-only phase, but the boolean round-trip took THREE attempts — a Node-RED editor gotcha worth recording. After oneditsave returns, Node-RED re-reads every `#node-input-<key>` DOM element for each key in `defaults` and overwrites this.<key> with the DOM value. (1) Setting this.forwardErrorsToClient in oneditsave was clobbered by the stale hidden input ('aus'→false passed only by coincidence). (2) Writing $("#node-input-forwardErrorsToClient").val("true"/"false") stored the STRING "false" — which is TRUTHY, so it broke both the strict-boolean test and (worse) the runtime secure-default guard. (3) CORRECT FIX: back forwardErrorsToClient with a hidden <input type="checkbox"> and set .prop('checked', val !== 'aus') in oneditsave — Node-RED reads checkboxes back as real booleans. Severity stays a hidden text field via .val(). LESSON: a Node-RED boolean `defaults` field must be backed by a checkbox element, never a hidden text input (string "false" is truthy). All three round-trip regressions were caught by the orchestrator's main-checkout E2E run; worktrees cannot bootstrap Playwright.


**Cost:** session <see .ai/agent-runs.jsonl>; impl 2026-06-06T23:18Z→23:23Z + fix1 23:24Z→23:29Z + fix2 23:30Z→23:33Z; orchestrator main-checkout E2E across 3 iterations; subagent_tokens ~150k across 3 agents
