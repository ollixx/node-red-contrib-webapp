---
id: P58
title: "ADR 0007 — action-message Contract (Schema) + Vorgehensentscheidung"
epic: aspects/schema
status: done
dependencies: [P57]
---
# P58 — ADR 0007 — action-message Contract (Schema) + Vorgehensentscheidung

## Result

**Delivered:** Codified the public msg.ui.action message contract as the single source of truth in packages/schema (actionMessageSchema + actionMessageCommandSchema) ahead of any behaviour change (decision-first, analog P54). Validates only msg.ui.action with the ADR-0005 verb set; foreign msg.* fields (payload/topic/_msgid) pass through via .passthrough() — no .strict() on msg/msg.ui. ADR 0007 (action-message contract + per-node interaction handlers) was already committed in the planning step. No runtime/nodes behaviour changed.

**Stats:** 5 files (+211/-42): packages/schema/src/contracts.ts (schema + inferred types ActionMessage/ActionMessageCommand), index.ts re-export, schema.test.ts (+11 unit tests); actions.md + messages.md reconciled to the contract. No diff in examples/customers-crud/flow.json.

**Notes:** Decision-first contract phase, no behaviour change in runtime/nodes (those land in P59/P60). Schema imports nothing from other repo packages (packages/schema invariant upheld). Docs drift from ADR-0005-Stop-Klasse 5 resolved: actions.md/messages.md now use `to` for navigate, `target` (not the stale `targetId`), and dropped the obsolete msg.ui.component.op / targetMode notes. Playwright was not bootstrappable in the isolated worktree (.node-red-dev/settings.js is owner-only), but P58 has zero browser-observable behaviour so nothing is E2E-testable this phase. Implemented in a git worktree on branch phase/P58 (484063f), merged --no-ff into develop by the orchestrator.


**Cost:** session <see .ai/agent-runs.jsonl>, 2026-06-06T21:32:37Z → 2026-06-06T21:39:41Z (~7m); subagent_tokens ~87.6k
