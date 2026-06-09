---
id: P46
title: "Per-node E2E — state and behavior nodes"
epic: aspects/test-infra
status: done
dependencies: [P45]
---
# P46 — Per-node E2E — state and behavior nodes

## Result

**Delivered:** 14 E2E specs for 4 state/behavior nodes: ui-store (4), ui-query (3), ui-action (4), ui-navigation (3) — covering rendering, SSE updates, store mutation, dialog lifecycle, and navigation.

**Stats:** 4 spec files (14 tests) in tests/e2e/nodes/behavior/; FlowBuilder extended with withStoreInject() helper and x/y defaults for non-visual nodes

**Notes:** Key finding: nodes without x/y coordinates in the flow JSON are treated as config nodes by Node-RED (flow.configs instead of flow.nodes), which causes "Circular config node dependency" errors and prevents inject-node registration. Fixed by adding x: 100, y: <N> to all non-visual node defaults in FlowBuilder (ui-store, ui-query, ui-action, ui-navigation). The withStoreInject() helper was added to FlowBuilder to create inject→function→store pipelines, since inject nodes set msg.payload but the store handler reads msg.ui.store. Dialog lifecycle tests (openDialog/closeDialog) use store-driven state (state.ui.dialogs.<id>.open) rather than SSE command re-render, which matches the production pattern in customers-crud (fn node sets both draft store and dialog state store simultaneously). The SSE openDialog command alone cannot show a dialog because currentSnapshot.dialogs is empty until a store update triggers a snapshot push with the dialog included.


**Cost:** session <see .ai/agent-runs.jsonl>, 2026-06-04T06:55:39Z → 2026-06-04T13:19:48Z
