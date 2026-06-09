---
id: P44
title: "Per-node E2E — interactive view nodes (events + input ports)"
epic: aspects/test-infra
status: done
dependencies: [P43]
---
# P44 — Per-node E2E — interactive view nodes (events + input ports)

## Result

**Delivered:** Full lifecycle E2E specs for every interactive form control: ui-input, ui-checkbox, ui-switch, ui-radio, ui-select, ui-slider, ui-textarea, ui-datepicker. Plus ui-button click→POST /event (deferred from P43). Each spec covers rendering (element presence, label/prop attributes, disabled state), events (sl-change → POST /event with correct params), and input port (inject → re-navigate → asserts patched value). Five implementation bugs were discovered and fixed in the same phase: (1) FlowBuilder: nodes missing x/y coords were treated by Node-RED 4 as config nodes, causing "Circular config node dependency" errors and preventing inject node registration — fixed by adding x/y to all nodes; (2) FlowBuilder: interactive nodes missing required `value` bindingSchema field caused silent schema validation failures — fixed with literal defaults; (3) readDeployDefinitions: in-memory patches from viewNodePatchInputHandler were ignored when building SSE snapshots (read from flow file only) — fixed by merging live definition.value into the flow-file-derived definition; (4) webapp-serializer.js: sl-input, sl-select, sl-textarea, sl-input[type=date] did not render the `disabled` attribute — fixed by adding explicit disabled handling matching checkbox/switch pattern; (5) ui-input mapConfig + schema: disabled binding not threaded through — added disabled field to uiInputNodeDefinitionSchema and mapConfig.


**Stats:** 8 spec files + 1 button-events spec, 35 E2E tests; 5 implementation bug-fixes across schema, webapp.js, webapp-serializer.js, and test helpers

**Notes:** Input port tests use re-navigate strategy (inject → navigate again) rather than waitForSseSnapshot because: (a) the SSE mechanism works but relies on browser event listeners attaching before the push arrives, creating inherent race conditions in E2E; (b) re-navigate provides a deterministic assertion path since the snapshot builder reads patched in-memory definitions. The admin-api.ts injectMessage now retries up to 5x with exponential backoff to handle Node-RED 4's async flow start (setFlows resolves before nodes are registered). Slider value assertion accepts numeric or string form since Shoelace sl-range.value coerces at the JS level.


**Cost:** session a0ef64cc-0d56-43b8-a170-42191e3d46ff, 2026-06-03T16:22:59Z → 2026-06-04T06:01:43Z
