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
5. Flow files — `examples/customers-crud/flow.json` and `.node-red-dev/flows.json` are **generated** by `pnpm gen:example`. Do not hand-edit them. After any phase that renames or adds node fields, run `pnpm gen:example` as the final step. See `.ai/instructions/flow-files.instructions.md`.
6. Before any new code: commit existing uncommitted changes with a meaningful message.
7. Before marking a phase done: run `pnpm test` and `pnpm exec playwright test`. Both must pass.
8. When marking a phase done: write a `summary` to `docs/agent-roadmap-archive.yaml` and replace the full entry in `docs/agent-roadmap.yaml` with a slim archive reference. Format see `.ai/prompts/run-next-phase.prompt.md`.
9. If a phase uncovers an unresolved architecture decision: write it down in `docs/agent-roadmap.yaml` under the phase as a `blocker` and stop. Resolving it is a separate task — see the roadmap-evolution role below.

## Roles

Different tasks use different entry prompts. Start from the right one:

| Task | Entry prompt |
|---|---|
| Implement a single phase (one fresh session) | `.ai/prompts/run-next-phase.prompt.md` |
| Run many phases — context-efficient (recommended) | `.ai/prompts/run-roadmap-orchestrated.prompt.md` |
| Run many phases — single session (legacy, context-heavy) | `.ai/prompts/run-roadmap-until-blocked.prompt.md` |
| Only validate a completed phase | `.ai/prompts/validate-phase.prompt.md` |
| Only write missing tests for a phase | `.ai/prompts/write-tests.prompt.md` |
| Fix a bug / regression that is not a phase | `.ai/prompts/fix-bug.prompt.md` |
| Turn a decision into an ADR + new phases | `.ai/prompts/evolve-roadmap.prompt.md` |

For running multiple phases, prefer the **orchestrated** mode: it spawns one fresh sub-agent per phase so implementation detail never accumulates in the driving session. The single-session mode is kept only for cases where sub-agents are unavailable.

**Phase work vs. maintenance work.** The numbered rules above (one phase at a time, status updates, archive on done) govern *roadmap-phase* work. Bug fixes and roadmap evolution are not phases: they skip the phase-status bookkeeping but still obey the universal rules — test-first, commit hygiene, minimal-invasive patches, never overwrite user changes. Use the dedicated prompts above. If a bug fix reveals that the roadmap itself is wrong, hand off from `fix-bug` to `evolve-roadmap`.

When implementing phases that add new node types (P16a-d or similar), invoke the `/node-red-node` skill first — it contains the complete four-file pattern, code templates, and checklist so the agent does not need to read existing node files to derive the pattern.
