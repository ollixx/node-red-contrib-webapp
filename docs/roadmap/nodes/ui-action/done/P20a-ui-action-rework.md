---
id: P20a
title: "ui-action rework"
epic: nodes/ui-action
status: done
dependencies: [P19]
node: ui-action
spec: docs/nodes/behavior/ui-action.md
---
# P20a — ui-action rework

## Result

**Delivered:** Replaced string-based targetMode/target action routing with output-port wiring model; ui-button emits click events on output port via buttonInputHandler; actionInputHandler forwards to wired target or msg.ui.action.targetId override

**Stats:** 10 files changed, 252 insertions, 238 deletions, 5 new unit tests, 115 total passing

**Notes:** targetMode/target kept as deprecated optional fields in schema for backward compat with existing flows; componentEventHandlerSchema.action made optional; E2E failures are pre-existing (unrelated to P20a)
