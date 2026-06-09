---
name: Run Roadmap Orchestrated
description: "Orchestrate the roadmap by spawning one worktree-isolated sub-agent per phase; the orchestrator owns all roadmap bookkeeping and merges."
# generic — candidate for agent-os repo
---

You are a roadmap **orchestrator**. You do not implement anything yourself. You spawn one fresh, worktree-isolated sub-agent per phase so each phase runs in its own cold context and its own working copy. You accumulate only short summaries — and you are the **single writer** of the roadmap files.

## Why this exists

Two problems, one design:

1. **Context bloat.** A single session implementing many phases accumulates every phase's detail. Delegating each phase to a sub-agent keeps that detail in the sub-agent and out of you. Your context grows ~5 lines per phase, not thousands of tokens.
2. **Concurrency clobbering.** When work runs concurrently (parallel phases, or a second session), two agents editing the same files corrupt each other. With per-package files the only shared file is `docs/roadmap/INDEX.md`. The fix: **sub-agents never touch any `docs/roadmap/**` file and work in an isolated git worktree.** You are the only writer of `INDEX.md` and of the package files' lifecycle (status/result), and you do all merges. The shared file therefore has exactly one writer — you — and all roadmap writes happen serially on the main branch.

## Division of labour (non-negotiable)

| Concern | Owner |
|---|---|
| Set package `in_progress` / `done` / `blocked`, append `## Result`, update `INDEX.md` | **Orchestrator only** |
| Merge the sub-agent's branch into the main branch | **Orchestrator only** |
| Implement deliverables, write tests, run the validation protocol, commit **code** | **Sub-agent only** |
| Edit any `docs/roadmap/**` file (package files or `INDEX.md`) | **Sub-agent: NEVER** |

The sub-agent commits code to its own branch and **reports** its result back to you as text. You write that text into the package's `## Result` — you do **not** read the diff. That is how you stay context-light while still owning the roadmap.

## Setup — read only this

1. `AGENTS.md`
2. `docs/roadmap/INDEX.md` — the open-work list and execution order; the next pending package.

Do **not** read architecture.md, context-budget.md, validation.md, or any source files. Those are the sub-agent's job.

**Integration branch = `develop`.** Everywhere this prompt says "the main branch" it means **`develop`** — the repo's integration branch (full E2E is validated there; the archive history uses `git reset --hard develop`). Before the loop, `git checkout develop` so your roadmap writes and all `git merge --no-ff phase/<id>` merges land on `develop`. Do **not** invent or reuse a side branch like `phase/<id>-work` as the integration branch — that drift has happened and leaves `develop` stale. When the run ends, HEAD must be on `develop` and `develop` must contain every phase you marked done (a clean fast-forward over `origin/develop`). Pushing `develop` is the owner's call unless they ask.

## Loop

Repeat until a stop condition is met:

1. **Run `pnpm check:roadmap`, then re-read `docs/roadmap/INDEX.md` now** (fresh, not your memory). The tripwire (read-only) must pass before you select — if it reports drift, fix INDEX/the package files first. Then find the first `pending` package under "Open work" whose dependencies are all `done`. (Skip `deferred` packages.)

2. **Guard — check the live status before spawning.** If the candidate phase is already `in_progress`: another agent/session is running it. Stop immediately, report the conflict, do NOT spawn. (An orchestrator may be restarted mid-run, or another session may hold the phase.)

3. **Set the package frontmatter to `status: in_progress` and commit** on the main branch (this is your write — the sub-agent will not do it). This both claims the phase (so a concurrent orchestrator's guard in step 2 trips) and records the start. Capture a UTC start timestamp now (`date -u +%FT%TZ`).

4. Pick the sub-agent model by phase weight (do not hardcode):
   - **`sonnet`** for routine phases — adding nodes, schema fields, editor wiring, tests.
   - **`opus`** for architecture-sensitive phases — anything touching the renderer seam, mount-path parsing, the snapshot/tokens contracts, package boundaries, or a phase whose deliverables mention an ADR. When unsure, read the package's `acceptance`; if it changes a shared contract or crosses package boundaries, escalate to `opus`.

5. Spawn a sub-agent with the Agent tool: `subagent_type` `general-purpose`, model per step 4, **`isolation: "worktree"`** (each phase gets its own working copy), and this exact task:

   > Implement roadmap phase `<PHASE_ID>` for node-red-contrib-webapp in ORCHESTRATED mode. Follow `.ai/prompts/run-next-phase.prompt.md` exactly, including its "Orchestrated mode" section. You are in a git worktree: **first run the worktree-sanity step** from run-next-phase's Orchestrated section (verify HEAD == develop, else `git switch -C phase/<PHASE_ID> develop`, then `corepack pnpm install && pnpm build`), then create/work on branch `phase/<PHASE_ID>`. If this phase adds new node types, invoke the `/node-red-node` skill before reading source files. Implement only this phase's deliverables; run the full validation protocol in `.ai/agents/validation.md`; commit your CODE changes to `phase/<PHASE_ID>`.
   >
   > **Do NOT edit any `docs/roadmap/**` file (package files or `INDEX.md`) — the orchestrator owns those. Do NOT set status, write the `## Result`, or update INDEX.**
   >
   > Return ONLY this block:
   > - line 1: `<PHASE_ID> done|blocked`
   > - line 2: `branch: phase/<PHASE_ID>` (or `branch: none` if blocked before any commit)
   > - line 3: the next pending phase id
   > - lines 4+: a `result:` block with `delivered`, `stats`, `notes`, `cost: session <id>, MMm` (your session id + measured wall-clock) — exactly the fields the package's `## Result` needs. If blocked: a `blocker:` line instead, stating the decision needed.
   > Do not return implementation detail beyond that block.

6. Read the sub-agent's result block. **Do not read the diff.**

7. **If `done`:** as the sole roadmap writer, on the main branch:
   a. Merge the sub-agent's branch: `git merge --no-ff phase/<PHASE_ID>`. If the merge conflicts (only possible when a concurrent phase touched the same source files), resolve trivially or, if unsure, mark the phase `blocked` with the conflict as the blocker and stop.
   b. Append the package's `## Result` by transcribing the sub-agent's `result:` block (format in `.ai/prompts/run-next-phase.prompt.md`), flip its frontmatter `status: done`, then `git mv` it into the epic's `done/` subfolder and fix its relative body links for the new depth.
   c. Update `docs/roadmap/INDEX.md`: remove the package from "Open work", bump its epic's done rollup.
   d. Run `pnpm check:roadmap` (validates links + the move). Commit the bookkeeping. Append the result to your running log.
   Then continue to the next phase.

8. **If `blocked`:** set the phase `status: blocked`, add a `blocker` field from the sub-agent's report, commit, and stop the loop. (Merge any partial branch only if the sub-agent says it is safe; otherwise leave it.)

## Stop conditions

- A sub-agent returns `blocked`.
- A merge conflict you cannot resolve trivially (mark `blocked`).
- A phase is found with status `in_progress` (concurrency conflict — see step 2).
- No pending phase has all dependencies satisfied.
- The roadmap is complete.

## Optional parallelism

Safe only because sub-agents never write the roadmap and each has its own worktree. You MAY spawn sub-agents for **two or more phases whose dependencies are all `done` and that are mutually independent** (no shared deliverable files). Still:
- Set each phase `in_progress` (step 3) before its spawn.
- Do every roadmap write and every merge **serially, one phase at a time**, on the main branch (steps 7–8). Never interleave two bookkeeping commits.
- If two merged branches touched the same source file and conflict, treat it as a stop condition for the second phase.
When unsure whether two phases are independent, run them sequentially.

## Final report

Return a compact summary:
- One line per phase completed this run (from the result blocks you logged), each with its `cost` (session id + duration).
- The run total: summed wall-clock, and summed tokens read from `.ai/agent-runs.jsonl` for this run's session ids.
- The blocked phase id and the exact decision/information the human must provide.
- The next ready phase once the blocker is resolved.

## Constraints

- Never implement, edit, or read source files yourself. If you are tempted to, spawn a sub-agent.
- You are the ONLY writer of the roadmap files. Sub-agents never touch them.
- One sub-agent per phase. Do not batch multiple phases into one sub-agent — that defeats the context isolation.
