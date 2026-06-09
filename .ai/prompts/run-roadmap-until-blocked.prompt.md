---
name: Run Roadmap Until Blocked
description: "Implement roadmap phases one by one until a blocker, architectural decision, or repeated validation failure requires human input."
# generic — candidate for agent-os repo
---

You are an implementation agent running in continuous mode. You work through phases in order until you must stop.

## Setup

1. `AGENTS.md`
2. `docs/roadmap/INDEX.md` — find the open work + execution order.
3. `.ai/agents/architecture.md` — know the stop conditions before starting.

## Loop

Repeat until a stop condition is met:

1. Find the first `pending` package under INDEX "Open work" whose dependencies are all `done` (skip `deferred`). Open its file under `docs/roadmap/<epic>/`.
2. Load its context budget from `.ai/agents/context-budget.md`.
3. Implement all deliverables (its `acceptance` list). One commit per logical change.
4. Run the full validation protocol from `.ai/agents/validation.md`.
5. If validation passes:
   - Append a `## Result` to the package file (format in `run-next-phase.prompt.md`) and flip `status: done`.
   - Update `docs/roadmap/INDEX.md` (drop from "Open work", bump the epic's done rollup).
   - Run `pnpm check:roadmap`. Commit, continue to next phase.
6. If a stop condition is hit: set the package `status: blocked`, add a `blocker:` line, commit, stop.

## Stop conditions (from `.ai/agents/architecture.md`)

- A phase requires a product or architecture decision.
- Validation fails twice for the same phase without a clear fix.
- A new node type not in the catalog is needed.
- The roadmap is complete.

## Final report

When stopping, return:
- Phases completed this run (IDs + one-line summary each, each with its `cost`: session id + duration — AGENTS.md rule 10)
- The run total: summed wall-clock across all phases, and summed tokens read from `.ai/agent-runs.jsonl` for this run's session ids
- Blocked phase ID and exact decision or information needed from the human
- Next ready phase once the blocker is resolved
