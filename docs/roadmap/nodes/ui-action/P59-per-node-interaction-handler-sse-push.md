---
id: P59
title: "Per-Node Interaction-Handler — SSE-Push wandert aus ui-action in den Zielknoten"
epic: nodes/ui-action
status: done
dependencies: [P58]
node: ui-action
spec: docs/nodes/behavior/ui-action.md
---
# P59 — Per-Node Interaction-Handler — SSE-Push wandert aus ui-action in den Zielknoten

## Result

**Delivered:** Moved the central SSE action-push OUT of ui-action and INTO the target nodes via a shared interactionInputHandler(ownedVerbs) factory in nodes/webapp.js (generalized from the ui-toast pattern): the handler resolves command.target = node.id (msg override wins), applies part/to/overrides, reflects render-affecting verbs into the per-client/broadcast snapshot state channel and pushes a snapshot, and passes msg through; a non-owned verb is a pass-through (no silent swallow). Verb ownership registered (ui-dialog→open/close; view nodes→show/hide; button/input→enable/disable; input→focus/reset; single-active→select; ui-app & ui-route→navigate/reset). ui-app and ui-route gained inputs:1. ui-action became a pure typed emitter that builds a schema-valid msg.ui.action (P58 contract) and sends it out its output port, with a documented receive()-based backward-compat path for old flows (config target + unwired port).

**Stats:** nodes/webapp.js, resources/lib/webapp-client.js, ui-action/ui-app/ui-route editor HTML; +P59 unit tests (runtime 254 total); actions.md/ui-action.md/messages.md updated; examples regenerated. E2E 250 passed / 0 failed; pnpm validate green (schema 142, renderer 10, editor 10, runtime 254).

**Notes:** Landed in three merges: phase/P59 (initial), phase/P59-fix (wired open-dialog), phase/P59-fix2 (select + navigate verbs + editor test). IMPORTANT correctness lesson — the initial implementation introduced THREE E2E regressions that the sub-agents could not catch because Playwright does not bootstrap inside an isolated git worktree (the webServer copies the owner-only .node-red-dev/settings.js, absent in worktrees). The orchestrator ran the full E2E suite in the main checkout and found: (1) wired ui-action(open)→ui-dialog no longer opened; (2) the select verb (accordion) no longer applied; (3) a navigate verb wired to ui-app/ui-route no longer routed. All three were verified PASSING at the pre-P59 commit (364502c), confirming they were P59-introduced, not pre-existing. Common root cause: the thin client renders component state only from the snapshot, so a transient `command` SSE that changes rendered state (open/close/select/show/hide) is invisible unless reflected into the snapshot state channel; navigate needed an owning node (ui-app) to receive it. Fixes generalized the snapshot-overlay path for all render-affecting verbs and routed navigate to the owning ui-app via receive(). The ui-app "no input port" editor test (structure.spec.ts:48) was updated to expect inputs:1 — the intended P59 change, not a revert. ORCHESTRATION TAKEAWAY: never trust a sub-agent's E2E "green" claim from a worktree; the orchestrator must run the full Playwright suite in the main checkout before marking any behaviour phase done.


**Cost:** session <see .ai/agent-runs.jsonl>; impl 2026-06-06T21:42Z→21:58Z (~16m) + fix 22:00Z→22:17Z (~18m) + fix2 22:26Z→22:44Z (~19m); orchestrator E2E verification + pre-P59 ground-truth runs in main checkout; subagent_tokens ~378k across 3 agents
