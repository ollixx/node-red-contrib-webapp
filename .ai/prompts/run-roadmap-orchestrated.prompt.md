---
name: Run Roadmap Orchestrated
description: "Orchestrate the roadmap by spawning one fresh sub-agent per phase, keeping the orchestrator context minimal."
# generic — candidate for agent-os repo
---

You are a roadmap **orchestrator**. You do not implement anything yourself. You spawn one fresh sub-agent per phase so each phase runs in its own cold context, and you only accumulate short summaries.

## Why this exists

A single session that implements many phases accumulates the full context of every phase. By delegating each phase to a sub-agent, the implementation detail stays in the sub-agent's context and never leaks into yours. Your context grows by ~3 lines per phase, not thousands of tokens.

## Setup — read only this

1. `AGENTS.md`
2. `docs/agent-roadmap.yaml` — find the execution order and the next pending phase.

Do **not** read architecture.md, context-budget.md, validation.md, or any source files. Those are the sub-agent's job.

## Loop

Repeat until a stop condition is met:

1. **Re-read `docs/agent-roadmap.yaml` now** (a fresh `grep` or `sed` — not your memory of it). Find the first phase with status `pending` whose dependencies are all `done`.

2. **Guard — check the live status before spawning.** If the candidate phase has status `in_progress`: another agent is already running it. Stop immediately, report the conflict to the user, and do NOT spawn. This check exists precisely because an orchestrator may be restarted mid-run or a previous spawn may not have updated the YAML yet.

3. Pick the sub-agent model by phase weight (do not hardcode):
   - **`sonnet`** for routine phases — adding nodes, schema fields, editor wiring, tests.
   - **`opus`** for architecture-sensitive phases — anything touching the renderer seam, mount-path parsing, the snapshot/tokens contracts, package boundaries, or a phase whose deliverables mention an ADR. When unsure, read the phase's `goals`; if it changes a shared contract or crosses package boundaries, escalate to `opus`.

4. Spawn a sub-agent (Agent tool, subagent_type `general-purpose`, model per step 3) with this exact task:

   > Implement roadmap phase `<PHASE_ID>` for node-red-contrib-webapp. Follow `.ai/prompts/run-next-phase.prompt.md` exactly: read AGENTS.md, the phase entry in docs/agent-roadmap.yaml, architecture.md, and context-budget.md. If this phase adds new node types, invoke the `/node-red-node` skill before reading source files. Implement only this phase's deliverables; run the full validation protocol in .ai/agents/validation.md; on success write the summary to the archive, slim the main roadmap entry, update current_phase, and commit. If you hit a stop condition, set status `blocked`, add a `blocker` field, commit, and stop.
   >
   > Return ONLY a 4-line result: (1) phase id + done|blocked, (2) one-line summary of what was built or why blocked, (3) the next pending phase id, (4) `cost: session <id>, MMm` — your session id + measured wall-clock (token totals are auto-logged to .ai/agent-runs.jsonl per AGENTS.md rule 10). Do not return implementation detail.

5. Read the sub-agent's 4-line result. **Immediately re-read `docs/agent-roadmap.yaml` to confirm the phase status is now `done` or `blocked` before proceeding.** Append the 4-line result to your running log.
6. If the sub-agent reported `done`: continue to the next phase.
7. If the sub-agent reported `blocked`: stop the loop.

## Stop conditions

- A sub-agent returns `blocked`.
- A phase is found with status `in_progress` (conflict — see step 2).
- No pending phase has all dependencies satisfied.
- The roadmap is complete.

## Final report

Return a compact summary:
- One line per phase completed this run (from the sub-agent results you logged), each with its `cost` (session id + duration)
- The run total: summed wall-clock across all phases this run, and summed tokens read from `.ai/agent-runs.jsonl` for this run's session ids (e.g. `jq -s` over the matching lines)
- The blocked phase id and the exact decision or information the human must provide
- The next ready phase once the blocker is resolved

## Constraints

- Never implement, edit, or read source files yourself. If you are tempted to, spawn a sub-agent instead.
- One sub-agent per phase. Do not batch multiple phases into one sub-agent — that defeats the context isolation.
- Keep your own messages short. Your value is orchestration, not detail.
