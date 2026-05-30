# Agent Entry Point
<!-- project-specific — belongs in this repo, not in agent-os -->

Read this file first. Then read only what your current task requires.

## Quick orientation

| File | Read when |
|---|---|
| `docs/agent-roadmap.yaml` | Always — find the current phase (first with status `pending` and all dependencies `done`) |
| `.ai/agents/architecture.md` | Before any implementation — know the package boundaries and stop conditions |
| `.ai/agents/validation.md` | Before marking any phase done — three-step self-validation protocol |
| `.ai/agents/context-budget.md` | Before reading any file — know the minimum file set for your role |

Do not read `prd.md` or `docs/implementation-plan.md` unless explicitly instructed. The roadmap is the source of truth.

## Non-negotiable rules

1. Work on exactly one roadmap phase at a time.
2. Update `docs/agent-roadmap.yaml` status when a phase starts (`in_progress`), completes (`done`), or is blocked (`blocked`).
3. Never overwrite user changes unless explicitly asked.
4. Minimal-invasive patches only — no unrequested reformatting or restructuring.
5. Flow files (`.node-red-dev/flows.json`, `examples/customers-crud/flow.json`) — change only exactly what is asked. See `.ai/instructions/flow-files.instructions.md`.
6. Before any new code: commit existing uncommitted changes with a meaningful message.
7. Before marking a phase done: run `pnpm test` and `pnpm exec playwright test`. Both must pass.
8. When marking a phase done: write a `summary` to `docs/agent-roadmap-archive.yaml` and replace the full entry in `docs/agent-roadmap.yaml` with a slim archive reference. Format see `.ai/prompts/run-next-phase.prompt.md`.
8. If a phase uncovers an unresolved architecture decision: write it down in `docs/agent-roadmap.yaml` under the phase as a `blocker` and stop.

## Roles

Different tasks use different entry prompts. Start from the right one:

| Task | Entry prompt |
|---|---|
| Implement the next roadmap phase | `.ai/prompts/run-next-phase.prompt.md` |
| Run phases autonomously until blocked | `.ai/prompts/run-roadmap-until-blocked.prompt.md` |
| Only validate a completed phase | `.ai/prompts/validate-phase.prompt.md` |
| Only write missing tests for a phase | `.ai/prompts/write-tests.prompt.md` |
