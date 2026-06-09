---
id: P82
title: "Klassische Verhaltens-Tests Input-Knoten (checkbox/datepicker/input/radio/select/slider/switch/textarea): msg.payload→value+Push, Interaktions-Verben (show/hide/enable/disable/focus/reset), submit-Event (input/textarea), select multiple→Array, datepicker mode→type, Pass-Through; E2E auf Editor+Render eindampfen"
epic: aspects/test-infra
status: done
dependencies: [P81]
---
# P82 — Klassische Verhaltens-Tests Input-Knoten (checkbox/datepicker/input/radio/select/slider/switch/textarea): msg.payload→value+Push, Interaktions-Verben (show/hide/enable/disable/focus/reset), submit-Event (input/textarea), select multiple→Array, datepicker mode→type, Pass-Through; E2E auf Editor+Render eindampfen

## Result

**Delivered:** Classic behaviour test file p82-input-nodes-behaviour.test.ts with 40 unit tests covering all 8 input-category nodes via the shared NodeBehaviourHarness: msg.payload→literalBinding value mutation + pass-through; interaction verbs (show/hide/enable/disable/focus/reset)→SSE command push; non-owned verb pass-through; unregistered-node edge case; ui-input+ui-textarea submit via dispatchClientEvent; ui-select multiple→array; ui-datepicker mode preserved through mapConfig+patch. Trimmed the inject→re-navigate→DOM-update behaviour tests from all 8 E2E view specs (rendering + sl-change→POST/event E2E retained).

**Stats:** 1 new test file (+40 unit, 392→432); 8 E2E specs trimmed (-8 inject tests); 0 source files changed; full validate green; playwright 289 passed.

**Notes:** viewNodePatchInputHandler calls readDeployDefinitions(RED) (reads disk) not collectLiveDefinitions() (reads runtimeState), so snapshot pushes are silent no-ops in unit tests. Tests therefore assert definition-state mutation (the canonical observable) rather than SSE snapshot events. No source changes needed; the P81 harness worked as documented.


**Cost:** session aa1c99dc70c510200, 17m
