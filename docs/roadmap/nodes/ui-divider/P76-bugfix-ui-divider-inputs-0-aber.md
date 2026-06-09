---
id: P76
title: "Bugfix: ui-divider `inputs: 0`, aber show/hide-Component-State-Messages werden dokumentiert/verdrahtet (componentStateInputHandler unerreichbar). Input-Port aktivieren oder Verhalten konsistent machen"
epic: nodes/ui-divider
status: done
dependencies: [P16c]
node: ui-divider
spec: docs/nodes/display/ui-divider.md
---
# P76 — Bugfix: ui-divider `inputs: 0`, aber show/hide-Component-State-Messages werden dokumentiert/verdrahtet (componentStateInputHandler unerreichbar). Input-Port aktivieren oder Verhalten konsistent machen

## Result

**Delivered:** Removed the unreachable componentStateInputHandler from the ui-divider entry in runtimeNodeRegistry (nodes/webapp.js) — the node declares inputs:0 so Node-RED never delivers messages; the handler was dead code. Added p76-divider-no-input-handler.test.ts (2 tests) asserting the registry entry carries no inputHandler. Runtime now consistent with spec (ui-divider.md §Input: no input port, no handler).

**Stats:** 2 files changed (+46/-3); 372→374 unit tests.

**Notes:** One-liner removal plus clarifying comment. Chose 'remove handler' over 'add inputs:1' because the spec is unambiguous — ui-divider is a static leaf node with no input/output port.


**Cost:** session a5fc165d115ab618a, 3m
