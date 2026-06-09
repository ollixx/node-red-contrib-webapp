---
id: P45
title: "Per-node E2E — composite and layout nodes"
epic: aspects/test-infra
status: done
dependencies: [P44]
---
# P45 — Per-node E2E — composite and layout nodes

## Result

**Delivered:** 34 E2E specs for 9 composite/layout nodes: ui-table, ui-container, ui-tabs, ui-accordion, ui-menu, ui-list, ui-pagination, ui-stepper, ui-toast — covering rendering, events, and input ports.

**Stats:** 7 spec files (34 tests) in tests/e2e/nodes/composite/; 10 runtime/schema/serializer bug-fixes across 6 files

**Notes:** Several pre-existing bugs were uncovered and fixed: (1) ui-list, ui-pagination, ui-stepper not in P16X_KIND_MAP — added with value-binding aliases; (2) parseList used for JSON-array inputs in accordion/tabs/menu/stepper mapConfigs — switched to parseJsonList with parseList fallback; (3) parseColumns used parseList on JSON array strings — same fix; (4) listItemSchema missing id field — Zod was stripping it; (5) menuItemSchema missing route/href fields — stripping caused empty hrefs; (6) ui-list missing from getDefinitionBuckets components filter; (7) readDeployDefinitions merge only patched value field — extended to also merge rows (ui-table) and items (ui-list); (8) pagination/stepper serializer read component.page/totalPages directly but renderer stores them in props — fixed serializer to prefer props with literal-resolution fallback; (9) table serializer events read from component.events (always [] after Zod) — now reads component.props.events; (10) list/pagination/ stepper component events stored in props.componentEvents to avoid Zod uiEventNameSchema validation failure. ui-toast implemented: passThroughInputHandler replaced with toastInputHandler that pushes SSE "toast" events; client handles "toast" SSE frames by appending sl-alert to document.body.


**Cost:** session a0ef64cc-0d56-43b8-a170-42191e3d46ff, 2026-06-04T06:04:11Z → 2026-06-04T06:48:56Z
