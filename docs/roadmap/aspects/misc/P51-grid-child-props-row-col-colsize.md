---
id: P51
title: "Grid-Child-Props row/col/colSize/rowSize müssen positive Integer sein"
epic: aspects/misc
status: done
dependencies: [P49a]
---
# P51 — Grid-Child-Props row/col/colSize/rowSize müssen positive Integer sein

## Result

**Delivered:** Enforced positive-integer constraint (>= 1) on grid placement child props (row/col/colSize/rowSize) in both Zod schema and all 28 node HTML editor validate functions; layoutX/layoutY retain any-integer semantics; editor-common.js central placement-row injection now emits min=1 step=1 HTML attributes; layout.md documents the constraint and the explicit 0-allowed exception.

**Stats:** 33 files changed; 20 unit tests added (p51-grid-child-props.test.ts); 3 E2E tests added (p51-grid-child-props.spec.ts); 240 E2E tests all pass.

**Notes:** Node-RED input-error CSS class is not applied by the engine on input change — client-side validation triggered via the RED API validate function check (returns false for value=0), which is the correct mechanism; min/step HTML attributes confirmed present by E2E. No fixture 0-values found.

**Cost:** session a6b7dc9b8fa03bc79, 10m
