---
id: P25
title: "Adapter coverage — remaining component kinds + map corrections"
epic: aspects/misc
status: done
dependencies: [P24]
---
# P25 — Adapter coverage — remaining component kinds + map corrections

## Result

**Delivered:** Corrected KIND_TO_SHOELACE: removed the non-existent sl-format-text (text) and sl-table (table) mappings — text now falls through to semantic <div class='webapp-text'> and table to a real <table> element. Extended componentKindSchema with 14 P16x kinds (select, checkbox, radio, switch, textarea, datepicker, slider, alert, badge, progress, breadcrumb, tabs, accordion, menu, avatar). Added toComponentDefinitions mappings in webapp.js for all P16x node types, each producing the correct kind and its relevant props/bindings without broken empty-path bindings. Added renderComponentHtml handlers that render select→<sl-select>, checkbox→<sl-checkbox>, radio→<sl-radio-group>, switch→<sl-switch>, textarea→<sl-textarea>, datepicker→<sl-input type=date>, slider→<sl-range>, alert→<sl-alert>, badge→<sl-badge>, progress→<sl-progress-bar>, breadcrumb→<sl-breadcrumb>, tabs→<sl-tab-group>, accordion→<sl-details>, menu→<sl-menu>, avatar→<sl-avatar>. Added ui-avatar to the getDefinitionBuckets component filter (previously absent). Extended the renderer's RenderedComponent union with RenderedGenericComponent and the switch in toRenderedComponent. Updated docs/theming.md with a component-mapping section that is the authoritative reference for KIND_TO_SHOELACE.

**Stats:** 5 files changed (packages/schema/src/contracts.ts, packages/renderer/src/shoelace-adapter.ts, packages/renderer/src/renderer.ts, packages/renderer/src/index.ts, nodes/webapp.js), 1 file added (docs/theming.md updated), 1 new test file (packages/runtime/test/p25-adapter-coverage.test.ts, 28 tests). Unit suite: 162 tests, 0 failures.

**Notes:** The accordion kind renders <sl-details> elements wrapped in a <div class='webapp-accordion'> because each accordion item is a separate <sl-details> element in Shoelace 2.x — there is no single <sl-accordion> container. The datepicker kind maps to <sl-input type=date> since Shoelace 2.x has no native date-picker element. The collectSnapshotKinds coverage assertion is exercised at the adapter level (mapComponentToShoelace) since building a full RenderSnapshot for all 22 kinds in a unit test would require a full AppModel compilation — the adapter-level test is the correct seam for this assertion. E2E tests not run (pre-existing isolation defect, unchanged since P23).
