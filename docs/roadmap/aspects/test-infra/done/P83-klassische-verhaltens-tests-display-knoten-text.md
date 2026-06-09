---
id: P83
title: "Klassische Verhaltens-Tests Display-Knoten (text/button/table/container/avatar/image/icon/list/divider): msg.payload→Primärfeld+Push, Interaktions-Verb→SSE-Push, Event-Config (button click, table rowSelect/rowAction/checkboxChange, list itemClick/itemSelect), Pass-Through; fehlende Render-E2E (ui-icon, ui-divider) ergänzen; E2E sonst auf Editor+Render eindampfen"
epic: aspects/test-infra
status: done
dependencies: [P81]
---
# P83 — Klassische Verhaltens-Tests Display-Knoten (text/button/table/container/avatar/image/icon/list/divider): msg.payload→Primärfeld+Push, Interaktions-Verb→SSE-Push, Event-Config (button click, table rowSelect/rowAction/checkboxChange, list itemClick/itemSelect), Pass-Through; fehlende Render-E2E (ui-icon, ui-divider) ergänzen; E2E sonst auf Editor+Render eindampfen

## Result

**Delivered:** Classic behaviour tests for 8 display nodes (ui-text/button/table/container/avatar/image/icon/list) via NodeBehaviourHarness covering msg.payload→primary-field, interaction-verb→SSE-command, pass-through, button-click-emission, table/list event dispatch; fixed ui-divider render (was silently producing no output — missing from components filter, P16X_KIND_MAP, renderer kind list, and serializer); added render E2E for ui-icon (3 tests) and ui-divider (4 tests).

**Stats:** 8 files changed, +557; runtime 432→463 unit (+31); 296 E2E (+7); packages touched: schema, renderer, runtime, nodes/webapp.js, webapp-serializer.js, tests/helpers/flow-builder.ts. Orchestrator re-verified on develop: 715 unit + 296 E2E green.

**Notes:** ui-divider had a pre-existing render bug (four-layer fix: getDefinitionBuckets filter, P16X_KIND_MAP, componentKindSchema, renderer.ts + serializer) — analogous to the ui-icon/P77 render gap. buttonInputHandler has no pure pass-through by design (excluded from the pass-through test group with explanation). FlowBuilder gained a ui-divider case (wires:[] for inputs:0/outputs:0).


**Cost:** session a21385070ba7bbc58, 19m
