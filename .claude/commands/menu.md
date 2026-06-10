---
description: List all agent prompts and pick one to run immediately.
---
Show me the available agent launchers and let me pick one to run **now**.

Do exactly this:

1. Call the **AskUserQuestion** tool. There are 7 agent prompts but AskUserQuestion
   allows at most 4 options per question, so use a "More…" overflow:

   **Question 1 — "Which agent do you want to run?"** (header: "Agent"), options:
   - **Run roadmap (orchestrated)** — one worktree sub-agent per phase (`run-roadmap-orchestrated`)
   - **Evolve roadmap** — turn a decision into an ADR + packages (`evolve-roadmap`)
   - **Review agent-OS** — audit the agent-OS, use fable/opus (`review-agent-os`)
   - **More…** — show the remaining agents

   If the user picks **More…**, immediately call AskUserQuestion again:

   **Question 2 — "Which agent?"** (header: "Agent"), options:
   - **Run next phase** — implement the next ready roadmap phase, test-first (`run-next-phase`)
   - **Fix a bug** — non-phase bugfix, test-first (`fix-bug`)
   - **Validate phase** — run the 3-step validation, no code changes (`validate-phase`)
   - **Write tests** — backfill missing tests for a phase (`write-tests`)

2. Once one is chosen, **execute it immediately**: read the matching
   `.ai/prompts/<name>.prompt.md` in full and follow it exactly — identical to
   running its own `/<name>` command. If the chosen agent needs input it cannot
   self-derive (fix-bug needs a bug description; evolve-roadmap needs the
   decision), ask for that one line first, then proceed.

Keep option labels short; put each prompt's one-line purpose in the option description.
