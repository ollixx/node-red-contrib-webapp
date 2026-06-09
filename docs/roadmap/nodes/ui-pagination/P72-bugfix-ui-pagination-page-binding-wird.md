---
id: P72
title: "Bugfix: ui-pagination `page`-Binding wird nie aufgelöst — Editor speichert `currentPagePath`, Runtime liest `config.pagePath` (webapp.js ~3664) → immer leer. Editor/Runtime-Feldnamen angleichen + E2E"
epic: nodes/ui-pagination
status: done
dependencies: [P16c]
node: ui-pagination
spec: docs/nodes/navigation/ui-pagination.md
---
# P72 — Bugfix: ui-pagination `page`-Binding wird nie aufgelöst — Editor speichert `currentPagePath`, Runtime liest `config.pagePath` (webapp.js ~3664) → immer leer. Editor/Runtime-Feldnamen angleichen + E2E

## Result

**Delivered:** Fixed ui-pagination page binding: mapConfig now reads `config.currentPagePath` (editor field name) instead of `config.pagePath` (wrong name), so the page state binding is correctly resolved at render time.

**Stats:** 2 files changed (nodes/webapp.js, tests/e2e/nodes/composite/ui-pagination.spec.ts), 1 new test file (p72-pagination-page-binding.test.ts), 3 unit + 1 E2E test added; 349 unit, 285 E2E passing.

**Notes:** Fixed in two places in webapp.js: (1) runtimeNodeRegistry mapConfig (~line 4011, primary fix), (2) toComponentDefinitions p16 snapshot path (~line 922, defence-in-depth, dead code in practice since mapConfig already resolves it). E2E uses a literal binding for totalPages to isolate the fix from the separate unresolved-state-binding-for-totalPages concern.


**Cost:** session aca37ad987c9cbc35, 14m
