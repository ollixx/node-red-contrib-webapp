---
id: P47
title: "Per-node E2E — Node-RED editor property panels"
epic: aspects/test-infra
status: done
dependencies: [P46]
---
# P47 — Per-node E2E — Node-RED editor property panels

## Result

**Delivered:** NodeEditorPage page-object that drives the Node-RED EDITOR (canvas) at :1882, plus 39 editor-panel E2E tests across 4 specs covering field presence, required-field validation, parent SelectBoxes, optional-field persistence, output-port labels, and input ports for every node type.

**Stats:** 1 helper (tests/helpers/node-editor-page.ts) + 4 spec files (39 tests) in tests/e2e/nodes/editor/; 214 total E2E pass

**Notes:** Opening editor panels uses RED.editor.edit(RED.nodes.node(id)) — the established repo pattern (editor-mount-options, parent-selector specs) — rather than the scope's literal "double-click on canvas", which resolves to the same call but is far flakier. Nodes are injected via the admin API (FlowBuilder + deployFlow), so no drag-and-drop. Three Node-RED 4.x specifics had to be handled: (1) a first-run welcome-tour overlay (.red-ui-tourGuide-shade) intercepts clicks — dismissed via Escape in NodeEditorPage.open(); (2) the Done action is #node-dialog-ok in the tray toolbar (not the NR1.x footer button), and save() must wait for the tray to detach before a re-open binds to persisted values; (3) a node's `outputs` count comes from the flow JSON `wires`, so output-label tests configure an explicit event + outputs:1. Validation state reads Node-RED's own node.valid flag (same signal as the red node badge), not scraped CSS. Pre-existing bug found and documented (not fixed — out of P47 scope): ui-toast's editor wires its App selector through installReferenceSelectors({ parent: "ui-app" }), but that helper has no `parent` branch, so the select never populates with app options; the stored node.parent reference is still intact. No editor spec drives the webapp URL — editor and rendering tests are strictly separate per the phase constraint.


**Cost:** session <see .ai/agent-runs.jsonl>, 2026-06-04T13:22:17Z → 2026-06-04T13:48:24Z (~26m)
