---
description: Run the roadmap — one worktree-isolated sub-agent per phase; orchestrator owns all bookkeeping.
argument-hint: [optional scope, e.g. "until P104" or an epic]
---
Read `.ai/prompts/run-roadmap-orchestrated.prompt.md` in full and act as the orchestrator **exactly** as it specifies: run `pnpm check:roadmap` before each pick, set status, spawn one worktree sub-agent per phase (following `run-next-phase` in ORCHESTRATED mode), then merge + write the Result + update INDEX. You are the only writer of `docs/roadmap/**`.

Additional scope/constraints for this run: $ARGUMENTS
