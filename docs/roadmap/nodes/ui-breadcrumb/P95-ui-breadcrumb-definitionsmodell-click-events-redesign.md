---
id: P95
title: "ui-breadcrumb Definitionsmodell + Click-Events (Redesign)"
epic: nodes/ui-breadcrumb
status: done
dependencies: [P16c]
node: ui-breadcrumb
spec: docs/nodes/navigation/ui-breadcrumb.md
tests: tests/e2e/nodes/view/ui-breadcrumb.tests.md
---
# P95 — ui-breadcrumb Definitionsmodell + Click-Events (Redesign)

## Result

**Delivered:** Redesigned ui-breadcrumb definition model and click-event contract: new item formats ({label,action?,active?} objects and string arrays), all items clickable via data-webapp-breadcrumb-action attribute (no positional exclusion), active items get aria-current=page, optional layout=breadcrumb preset enables child-node slot mode (slots: default/separator).

**Stats:** 13 files changed; 19 new unit tests (p95-breadcrumb-redesign.test.ts); 7 fresh E2E tests; test catalogue .md; 686 total unit tests passing.

**Notes:** Schema: breadcrumbItemSchema (string|{label,action?,active?}), events enum extended to include 'click', layout field optional. Layout presets: 'breadcrumb' added to standardLayoutPresetIds (schema + editor-common.js + serializer getLayoutVariant). Runtime: mapConfig updated with itemsJson/array/JSON-string/binding/itemsPath resolution chain; show/hide added to INTERACTION_VERBS_BY_TYPE. Client: new data-webapp-breadcrumb-action handler.

**Cost:** session ad71353aafe83f9c0, 20m
