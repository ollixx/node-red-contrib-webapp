---
id: P53
title: "ui-action — vollständiges Interaktions-Verb-Set client-seitig + Vokabular-Entmischung"
epic: nodes/ui-action
status: done
dependencies: [P48]
node: ui-action
spec: docs/nodes/behavior/ui-action.md
---
# P53 — ui-action — vollständiges Interaktions-Verb-Set client-seitig + Vokabular-Entmischung

## Result

**Delivered:** Implemented the full ui-action interaction verb set end to end (show/hide/enable/disable/open/close/select/focus/reset) via a per-client, additive interaction-state overlay that survives snapshot re-renders, and resolved the doc-vs-impl vocabulary drift (ADR 0005); open/close gained target+part granularity, openDialog/closeDialog kept as aliases, submit/remove stay removed.

**Stats:** 13 files (1 ADR, 2 schema, serializer+client, webapp.js, ui-action editor, 3 docs, 2 test files); 5 new E2E verb specs + 5 new unit tests; unit 350 / E2E 226 all green; pnpm validate exit 0.

**Notes:** ADR 0005 committed. Core decision: interaction state lives ONLY client-side (ADR 0003 honoured) — additive overlay re-applied post-render; clearing a flag re-renders from snapshot then re-stamps, so a component's intrinsic disabled/visibility prop is never clobbered (this fixed a 9-test regression where the first overlay impl stripped server-rendered [disabled]). Schema was an implicit, unlisted deliverable: actionTypeSchema + uiActionNodeDefinitionSchema had to gain the new verbs and the `part` field or Zod silently rejected/stripped them. `trigger` kept as a legacy pass-through verb to avoid churning unrelated fixtures/tests; editor SelectBox omits it. gen:example and gen:node-examples produced no diff. Pruned a stale P33 friction note.

**Cost:** session worktree-agent-a51177dcf52a37faa, 32m
