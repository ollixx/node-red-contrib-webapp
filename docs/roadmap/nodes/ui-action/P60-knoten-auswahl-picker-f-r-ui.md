---
id: P60
title: "Knoten-Auswahl-Picker für ui-action (RED.view.selectNodes) + receive()-Fix + Multi-Target"
epic: nodes/ui-action
status: done
dependencies: [P59]
node: ui-action
spec: docs/nodes/behavior/ui-action.md
---
# P60 — Knoten-Auswahl-Picker für ui-action (RED.view.selectNodes) + receive()-Fix + Multi-Target

## Result

**Delivered:** Replaced ui-action's free-text target-node-ID field with a real multi-select canvas node picker via RED.view.selectNodes() (the pattern Node-RED core uses for catch/status/complete), filtered to interaction-capable webapp nodes, storing a LIST of target node IDs (`targets`) in the config — a reusable installNodePicker helper in the single canonical resources/lib/editor-common.js. On input, ui-action now delivers to each picked target — and the targetId/target override — via targetNode.receive(msg), the SAME input path as a wire (fixing the prior send()-injects-at-output bug). Wiring the output port stays the primary path; the picker is the secondary 'wireless' option. Works for ui-app/ui-route targets too.

**Stats:** ui-action.html, nodes/webapp.js, resources/lib/editor-common.js, packages/schema/src/node-definitions.ts; +P60 unit tests (schema + runtime; 419→ total) incl. a schema round-trip regression test; actions.md §2/§3 updated; 2 new E2E specs. E2E 252 passed / 0 failed; pnpm validate green.

**Notes:** Landed in two merges: phase/P60 (picker + receive() delivery) and phase/P60-fix. The orchestrator's main-checkout E2E run caught one regression the sub-agent could not (worktrees cannot bootstrap Playwright): the wireless picked-target path never opened the dialog. Root cause: the new `targets` list was never declared in uiActionNodeDefinitionSchema, so validateUiNodeDefinition (Zod strip-by-default) dropped it — node.webappDefinition.targets was always undefined and the wireless receive() loop never fired (the wired path worked because it carries msg.ui.action over a real wire). The hand-built unit tests bypassed validation so they missed it; the fix added `targets: z.array(identifierSchema).optional()` plus a schema round-trip regression test. Reinforces the P59 lesson: a schema field that the editor writes but the schema does not declare is silently stripped — always add a validation round-trip test, and always run E2E in the main checkout before marking a behaviour phase done.


**Cost:** session <see .ai/agent-runs.jsonl>; impl 2026-06-06T22:51Z→23:01Z (~10m) + fix 23:07Z→23:11Z (~4m); orchestrator main-checkout E2E verification; subagent_tokens ~160k across 2 agents
