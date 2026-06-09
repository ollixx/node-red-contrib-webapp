---
id: P38
title: "UI node events — all interactive nodes always emit their events"
epic: aspects/state
status: done
dependencies: [P37]
---
# P38 — UI node events — all interactive nodes always emit their events

## Result

**Delivered:** All interactive UI nodes (checkbox, switch, radio, select, slider, input, textarea, datepicker, tabs, pagination, stepper) now always emit a msg.ui change event on their output port when the user interacts. Fixed the change-handler param key in webapp-client.js: checkbox/switch now send { checked: bool } instead of { value: bool }. Added sl-tab-show event listener for tabs (Shoelace fires sl-tab-show not change; client translates to change with params.value = tab id). Added rendering cases in webapp-serializer.js for pagination (prev/next buttons with data-webapp-page) and stepper (step buttons with data-webapp-step); click handler detects these attributes and dispatches change with the correct params. Added outputLabels: 'event' to all 11 interactive node HTML editors.

**Stats:** 3 files modified (resources/lib/webapp-serializer.js, resources/lib/webapp-client.js, docs/agent-roadmap.yaml + archive). 11 node HTML files updated with outputLabels. 1 new test file (p38-node-events.test.ts, 20 tests). Unit suite: 206 tests, 0 failures. E2E: 54 tests, 0 failures. pnpm validate green.

**Notes:** P37 archive entry was missing; added it as part of this phase to unblock the roadmap check. Tabs use the Shoelace sl-tab-show custom event (not native change) — client adds a dedicated listener. Pagination/stepper have no Shoelace equivalent; rendered as sl-button/button groups with data-webapp-page/data-webapp-step attributes that the click handler detects and maps to change events.

**Cost:** session 2026-06-02T15:12:38Z → 2026-06-02T15:18:25Z / ~6m
