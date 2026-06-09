---
id: P79
title: "Bugfix/Decision: `targetId`-Diskrepanz — Runtime-Handler akzeptieren `msg.ui.action.targetId`, aber `actionMessageCommandSchema` ist `.strict()` und kennt nur `target` → targetId fällt durch die Validierung. Entscheiden: targetId ins Schema aufnehmen ODER Runtime-Alias entfernen; Doku (actions.md) angleichen"
epic: aspects/schema
status: done
dependencies: [P60]
---
# P79 — Bugfix/Decision: `targetId`-Diskrepanz — Runtime-Handler akzeptieren `msg.ui.action.targetId`, aber `actionMessageCommandSchema` ist `.strict()` und kennt nur `target` → targetId fällt durch die Validierung. Entscheiden: targetId ins Schema aufnehmen ODER Runtime-Alias entfernen; Doku (actions.md) angleichen

## Result

**Delivered:** Resolved the targetId discrepancy by removing the runtime `targetId` override alias so the action handlers match the strict actionMessageCommandSchema (which only knows `target`); `target` is now the single canonical override field everywhere.

**Stats:** 5 source/doc files (nodes/webapp.js, 2 runtime test files, docs/nodes/concepts/actions.md, docs/nodes/behavior/ui-action.md) + friction log; 2 new P79 unit tests; 628 unit + 297 E2E green.

**Notes:** Decision: removed the runtime alias rather than adding `targetId` to the schema — `.strict()` exists to catch command typos, so a redundant alias would undermine it; `target` stays canonical. Schema needed no change (already target-only; the existing 'rejects unknown field inside msg.ui.action' test already locks in targetId rejection). Updated buildActionCommand/buildInteractionCommand/actionInputHandler to read only override.target. Converted two override tests to `target`; added tests asserting a bare `targetId` is now ignored (falls back to config target). Aligned actions.md + ui-action.md. Historical ADR 0005/0007 references to targetId left untouched as decision-record history.


**Cost:** session a5625694e827b5239, 13m
