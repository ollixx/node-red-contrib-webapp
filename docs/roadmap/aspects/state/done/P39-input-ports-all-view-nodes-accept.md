---
id: P39
title: "Input ports — all view nodes accept incoming messages to update their state"
epic: aspects/state
status: done
dependencies: [P38]
---
# P39 — Input ports — all view nodes accept incoming messages to update their state

## Result

**Delivered:** Added inputs: 1 to 10 HTML node editors previously at inputs: 0 (ui-text, ui-button, ui-radio, ui-checkbox, ui-slider, ui-select, ui-input, ui-datepicker, ui-switch, ui-textarea). Nodes already at inputs: 1 unchanged (ui-badge, ui-alert, ui-progress, ui-image, ui-list, ui-avatar). Added viewNodePatchInputHandler and findAppIdForNode in nodes/webapp.js: msg.payload sets the primary mutable field (value for most, label for ui-button, src for ui-image/ui-avatar, message for ui-alert, rows for ui-table, items for ui-list) wrapped in a literalBinding; msg.ui.patch applies arbitrary field overrides merged directly into the definition. Both update runtimeState and call pushSnapshotToClients() to broadcast a fresh SSE snapshot. Extended buttonInputHandler to delegate to viewNodePatchInputHandler for payload/patch messages before emitting click events. Updated runtimeNodeRegistry inputHandler for all 17 affected node types to viewNodePatchInputHandler. Added docs/nodes/concepts/inputs.md documenting the msg.payload / msg.ui.patch contract with a table of primary fields per node.

**Stats:** 11 files modified (nodes/webapp.js, 10 view node HTML editors). 1 new doc file (docs/nodes/concepts/inputs.md). Unit suite: 206 tests, 0 failures. E2E: 54 tests, 0 failures. pnpm validate green.

**Notes:** msg.ui.component.op messages (show/hide/enable/disable/focus/reset) still delegate to componentStateInputHandler — no regression. Snapshot push is ephemeral; redeploy resets definitions from flow.json. findAppIdForNode resolves appId via node.z (flow tab ID) before falling back to getActiveRuntimeAppId().

**Cost:** session current / 2026-06-02T15:20:02Z → 2026-06-02T15:27:21Z / ~7m
