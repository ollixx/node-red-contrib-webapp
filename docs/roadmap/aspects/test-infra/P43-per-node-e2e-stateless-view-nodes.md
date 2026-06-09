---
id: P43
title: "Per-node E2E — stateless view nodes"
epic: aspects/test-infra
status: done
dependencies: [P42]
---
# P43 — Per-node E2E — stateless view nodes

## Result

**Delivered:** 36 Playwright E2E specs across 8 spec files covering every stateless view node: ui-text (text content, store binding, webapp-text wrapper), ui-button render-only (label, sl-button presence, disabled literal binding), ui-badge (sl-badge element, value, severity→variant), ui-progress (sl-progress-bar, value binding, label attribute), ui-alert (sl-alert element, severity→variant mapping, message binding), ui-breadcrumb (sl-breadcrumb, item count, label text, empty state), ui-avatar (sl-avatar element, src binding→image attribute), ui-skeleton (no-crash tests), ui-empty-state (no-crash tests), ui-image (server-serves-200 tests, noting node not in component filter). Three targeted implementation fixes landed as part of the phase: (1) breadcrumb mapConfig: Array.isArray(config.items) fast-path so static item arrays bypass parseList and survive Zod validation; (2) toComponentDefinitions: route alert.message and avatar.src bindings through bind.value so the renderer resolves them into component.value; (3) serializer: alert message and avatar src read component.value (the resolved string) rather than the raw binding object in props.


**Stats:** 8 spec files, 36 E2E tests; 3 implementation bug-fixes in nodes/webapp.js + webapp-serializer.js

**Notes:** Several deviations from the ideal scope: (1) ui-button variant prop is not plumbed through the config chain (not in spec doc or mapConfig) — variant tests omitted; only label, presence, and disabled-binding tests added. (2) All binding fields require proper {kind,…} objects — plain strings fail Zod bindingSchema validation and silently prevent node registration; tests use literal bindings throughout. (3) ui-image is not in the getDefinitionBuckets components filter and therefore renders nothing — tests verify server-serves-200 + no crash rather than DOM presence. (4) Shoelace web components do not reflect all attributes after upgrade (sl-avatar image/initials, sl-badge variant, sl-progress-bar value); assertions use .evaluate() to read JS properties where needed. (5) Breadcrumb mapConfig bug fixed in-phase; previous parseList behaviour converted object arrays to "[object Object]" strings.


**Cost:** session ccs_01BUjLzuLHRFrLWqhCc5LUkb6GdoNqJ3aWtDpCBZNu7mY2DTFJ5G, ~22m, 2026-06-03T15:58:50Z → 2026-06-03T16:20:34Z
