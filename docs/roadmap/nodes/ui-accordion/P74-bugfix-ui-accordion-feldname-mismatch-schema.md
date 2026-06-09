---
id: P74
title: "Bugfix: ui-accordion Feldname-Mismatch — Schema-Feld `sections` (accordionSectionSchema) vs. Editor/mapConfig `items` (webapp.js ~3613). Auf einen Namen vereinheitlichen + Validierung/Tests"
epic: nodes/ui-accordion
status: done
dependencies: [P16c]
node: ui-accordion
spec: docs/nodes/navigation/ui-accordion.md
---
# P74 — Bugfix: ui-accordion Feldname-Mismatch — Schema-Feld `sections` (accordionSectionSchema) vs. Editor/mapConfig `items` (webapp.js ~3613). Auf einen Namen vereinheitlichen + Validierung/Tests

## Result

**Delivered:** Unified ui-accordion field name to `sections` across all four layers: schema (already correct), editor HTML defaults/template, webapp.js mapConfig (reads config.sections, emits sections), props assembly block, and webapp-serializer.js renderer.

**Stats:** 7 files changed; 4 new unit tests (p74-accordion-sections-field.test.ts); fixes in nodes/view/ui-accordion.html, nodes/webapp.js (mapConfig + props assembly), resources/lib/webapp-serializer.js; E2E fixtures updated in 2 spec files + 1 unit test.

**Notes:** Straight rename — no schema change needed (schema was already `sections`). The props assembly block in webapp.js already had a pattern for conditional prop spreading; sections added there. E2E tests in ui-accordion.spec.ts and ui-action-verbs.spec.ts used the old `items` config key; both updated to `sections`.


**Cost:** session ab831d87afb677a40, 9m
