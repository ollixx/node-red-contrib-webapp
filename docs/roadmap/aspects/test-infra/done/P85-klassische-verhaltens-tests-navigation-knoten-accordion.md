---
id: P85
title: "Klassische Verhaltens-Tests Navigation-Knoten (accordion/breadcrumb/menu/pagination/stepper/tabs): select-Verb→SSE-Push (tabs/stepper/menu), Output-Event-Dispatch (pageChange/tabChange/stepChange/sectionOpen-close/navigate), msg.payload/patch, accordion multiple/defaultOpen, stepper complete + stepId-Contract, Pass-Through; fehlende Editor-E2E pro Knoten ergänzen"
epic: aspects/test-infra
status: done
dependencies: [P81]
---
# P85 — Klassische Verhaltens-Tests Navigation-Knoten (accordion/breadcrumb/menu/pagination/stepper/tabs): select-Verb→SSE-Push (tabs/stepper/menu), Output-Event-Dispatch (pageChange/tabChange/stepChange/sectionOpen-close/navigate), msg.payload/patch, accordion multiple/defaultOpen, stepper complete + stepId-Contract, Pass-Through; fehlende Editor-E2E pro Knoten ergänzen

## Result

**Delivered:** Classic behaviour tests for 6 navigation nodes (accordion/breadcrumb/menu/pagination/stepper/tabs) via NodeBehaviourHarness, plus per-node editor E2E specs (navigation-nodes.spec.ts).

**Stats:** 2 files; 49 unit tests (p85-navigation-nodes-behaviour.test.ts) + 9 E2E tests; suite 536 unit + 305 E2E; 0 source changes.

**Notes:** Navigation nodes use interactionInputHandler(INTERACTION_VERBS_BY_TYPE[type], componentStateInputHandler) — no viewNodePatchInputHandler, so msg.payload does not update definitions for these nodes (pass-through only). Editor output-label tests adjusted: accordion/tabs/stepper have static outputs:1 with no dynamic outputLabels function, unlike ui-table.


**Cost:** session a0a16884126e8bac7, 18m
