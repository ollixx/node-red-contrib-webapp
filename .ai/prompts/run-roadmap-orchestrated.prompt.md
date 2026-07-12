---
name: Run Roadmap Orchestrated
description: "Orchestrate the roadmap by spawning one worktree-isolated sub-agent per phase; the orchestrator owns all roadmap bookkeeping and merges."
# generic — candidate for agent-os repo
---

You are a roadmap **orchestrator**. You do not implement anything yourself. You spawn one fresh, worktree-isolated sub-agent per phase so each phase runs in its own cold context and its own working copy. You accumulate only short summaries — and you are the **single writer** of the roadmap files.

**Preferred orchestrator model: fable** (long-horizon bookkeeping, context continuity over many phases); **fallback: opus**. This is a preference, not a requirement — the prompt works unchanged on either.

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
   - **`fable`** (if available in the Agent tool's model list — trial access; otherwise use `opus`) for the heaviest of those architecture-sensitive phases: multiple packages changed in one phase, an ADR is among the deliverables, or the phase resolves a `blocked` predecessor. Model availability changes over time — treat these tiers as preferences, never fail a run because a preferred model is unavailable; fall back one tier.

5. Spawn a sub-agent with the Agent tool: `subagent_type` `general-purpose`, model per step 4, **`isolation: "worktree"`** (each phase gets its own working copy). **Before composing the task, capture two values:** `DEVELOP_SHA=$(git rev-parse develop)` and, if the phase has dependencies, the merge/close commit SHA of its latest dependency (a `SENTINEL` that proves the dependency's code is present). Pass BOTH into the task so the sub-agent pins its base to the real tip — a worktree's local `develop` ref has been observed lagging many commits behind (branching from a stale develop silently omits a just-merged dependency, and the agent then re-implements it). Use this exact task:

   > Implement roadmap phase `<PHASE_ID>` for node-red-contrib-webapp in ORCHESTRATED mode. Follow `.ai/prompts/run-next-phase.prompt.md` exactly, including its "Orchestrated mode" section. **HARDENED WORKTREE-SANITY — do this FIRST:** (a) the correct develop tip for this run is SHA `<DEVELOP_SHA>`; run `git rev-parse develop` and if it differs your local ref is stale; (b) create your branch from the explicit SHA, not the ref: `git switch -C phase/<PHASE_ID> <DEVELOP_SHA>`; (c) if this phase depends on another, verify the dependency's code is present: `git merge-base --is-ancestor <SENTINEL> HEAD && echo OK` must print `OK` — if not, STOP and return `blocked` with `blocker: stale base — dependency <dep> absent`, do NOT proceed or reimplement anything; (d) `corepack pnpm install && pnpm build`. Then work on branch `phase/<PHASE_ID>`. If a deliverable says to CONSUME a helper/contract from a dependency, `grep` that it already exists before starting — if absent, that is a stale base: STOP, do not reimplement it. If this phase adds new node types, invoke the `/node-red-node` skill before reading source files. Implement only this phase's deliverables; run the full validation protocol in `.ai/agents/validation.md`; commit your CODE changes to `phase/<PHASE_ID>`.
   >
   > **Do NOT edit any `docs/roadmap/**` file (package files or `INDEX.md`) — the orchestrator owns those. Do NOT set status, write the `## Result`, or update INDEX.**
   >
   > Return ONLY this block:
   > - line 1: `<PHASE_ID> done|blocked`
   > - line 2: `branch: phase/<PHASE_ID>` (or `branch: none` if blocked before any commit)
   > - line 3: the next pending phase id
   > - lines 4+: a `result:` block with `delivered`, `stats`, `notes`, `cost: session <id>, MMm` (your session id + measured wall-clock) — exactly the fields the package's `## Result` needs. If blocked: a `blocker:` line instead, stating the decision needed.
   > Do not return implementation detail beyond that block.

5a. **Schedule a stall-check wakeup.** Immediately after spawning (single or batch), call `ScheduleWakeup(300s, "<same /loop prompt>")` so you wake up if no task-notification arrives. On each wakeup, run the stall-detection procedure in **§ Stall detection** below for every phase still `in_progress`. If all expected agents have already reported (notifications arrived before the wakeup fired), skip the check and do not reschedule. If any are still running, reschedule at 300 s intervals until all report.

6. Read the sub-agent's result block. **Do not read the diff.**

7. **If `done`:** as the sole roadmap writer, on the main branch:
   a. Merge the sub-agent's branch: `git merge --no-ff phase/<PHASE_ID>`. If the merge conflicts (only possible when a concurrent phase touched the same source files), resolve trivially or, if unsure, mark the phase `blocked` with the conflict as the blocker and stop.
   b. **Verify the full E2E suite on the integration branch yourself — the sub-agent could not (its worktree can't reliably run Playwright).** FIRST `pnpm build` on the develop checkout — a merge brings in `packages/*/dist` source changes (schema/runtime/renderer) that the checkout's compiled artifacts do NOT reflect until rebuilt; running E2E against stale `dist` tests OLD behaviour and produces **false-reds** (e.g. a new schema field silently stripped at runtime). Then run E2E WITHOUT a tail/head pipe (a pipe masks Playwright's non-zero exit, and `tail` cuts off the `N failed` header — this has produced both false-greens that closed phases over real regressions AND false-reds from stale builds):
      ```
      pnpm build > /tmp/build-<PHASE_ID>.log 2>&1; echo "build exit=$?"
      pnpm exec playwright test > /tmp/e2e-<PHASE_ID>.log 2>&1; echo "exit=$?"
      grep -cE '[0-9]+ failed' /tmp/e2e-<PHASE_ID>.log   # must be 0
      ```
      If a spec is red, before concluding it is a real defect, re-run it after a clean `pnpm build` — a stale-`dist` false-red wastes a fix sub-agent and roadmap churn (it has).
      Only `exit=0` AND zero `failed` lines counts as green. Cross-check: if the phase added N tests, the suite total should rise by ~N; a flat total means something failed silently. **If red, do NOT close the phase** — diagnose (targeted re-run of the failing specs), spawn a fix sub-agent, re-verify; treat an unfixable regression as a `blocked` stop condition.
   c. Append the package's `## Result` by transcribing the sub-agent's `result:` block (format in `.ai/prompts/run-next-phase.prompt.md`), flip its frontmatter `status: done`, then `git mv` it into the epic's `done/` subfolder and fix its relative body links for the new depth.
   d. Update `docs/roadmap/INDEX.md`: remove the package from "Open work", bump its epic's done rollup.
   e. Run `pnpm check:roadmap` (validates links + the move). Commit the bookkeeping. Append the result to your running log.
   Then continue to the next phase.

8. **If `blocked`:** set the phase `status: blocked`, add a `blocker` field from the sub-agent's report, commit, and stop the loop. (Merge any partial branch only if the sub-agent says it is safe; otherwise leave it.)

## Stall detection

Triggered by a `ScheduleWakeup` firing while one or more phases are still `in_progress`.

For each such phase:

1. **Read `.ai/agent-status/<PHASE_ID>.json`.**
   - File missing AND phase has been `in_progress` for > 10 minutes → hard stall (agent never wrote a heartbeat).
   - File present but `lastAt` is more than 5 minutes ago → probable stall.
   - File present, `lastAt` recent, `backgroundTasks` is non-empty → agent is legitimately waiting on a long-running process (not a stall); reschedule and wait.

2. **Check git for partial work:** `git log phase/<PHASE_ID> ^develop` — note whether any commits exist.

3. **If stalled:**
   a. If `backgroundTasks` lists a task_id, attempt `Monitor(task_id, block=false)` to read its current output before concluding it is truly hung.
   b. Spawn a recovery agent directed at the existing worktree path (read from the status file's `worktreePath` if present, else derive from the standard path `<repo>/.claude/worktrees/agent-<original-id>`). Pass the status file content and the last Monitor output as context so the recovery agent knows exactly where work was interrupted and what was running.
   c. The recovery agent follows the same sub-agent contract (no roadmap edits; commit to `phase/<PHASE_ID>`; return the result block).

4. **Clean up** `.ai/agent-status/<PHASE_ID>.json` after merging a phase (whether done or blocked). A stale status file from a completed phase misleads future stall checks.

## Stop conditions

- A sub-agent returns `blocked`.
- A merge conflict you cannot resolve trivially (mark `blocked`).
- A phase is found with status `in_progress` (concurrency conflict — see step 2).
- No pending phase has all dependencies satisfied.
- The roadmap is complete.

In **watch mode** (below) the last three conditions become *reschedule and
re-check* instead of hard stops.

## Watch mode (opt-in — poll the roadmap forever)

By default the orchestrator drains the currently-open roadmap **once** and ends.
**When the run is asked to watch** (the invocation says *watch / poll / keep
running / run continuously / every N minutes*), it instead **polls for new open
work forever**, until the user stops it in chat. This is the self-draining queue:
whatever gets planned into `INDEX.md` is picked up on the next tick.

In watch mode the stop conditions above change:

- **"No pending phase" / "roadmap complete"** → NOT a stop. Instead: leave HEAD on
  `develop`, run `pnpm check:roadmap` (must pass), then call
  **`ScheduleWakeup(270s, …)`** (reason e.g. *"watching roadmap for new open
  work"*) and go idle. On wake, re-run `pnpm check:roadmap`, **re-read
  `docs/roadmap/INDEX.md` fresh** (not from memory), and re-enter the Loop from
  step 1. Use **270s**, not 300s — 270s stays inside the 5-minute prompt-cache
  window, a literal 300s just misses the cache for no benefit.
- **A candidate phase is `in_progress`** (another session/orchestrator holds it)
  → do **not** spawn and do **not** hard-stop: another writer is on it.
  `ScheduleWakeup(270s)` and re-check next tick — it may finish and leave more work.
- **`blocked` sub-agent / unresolvable merge conflict** → still mark *that phase*
  `blocked` and **report it in chat once**. But a `blocked` package is no longer
  `pending`, so the picker skips it and the watcher keeps polling for **other**
  pending work — a block does not halt the loop. (A human clears the block
  separately via the roadmap-evolution role.)

Rules that still hold in watch mode (do not relax these):
- **Single writer + concurrency guard, unchanged:** set `in_progress` before each
  spawn; verify the **full E2E on `develop`** before closing; one bookkeeping
  commit at a time; never let a sub-agent touch `docs/roadmap/**`.
- **Report every pickup and close-out in chat** (one line each) so the user sees
  progress and can stop the loop at any point.
- **No idle timeout — runs forever.** It ends only when the user stops it (in chat,
  or `ScheduleWakeup` with `stop: true`) or on a genuine unrecoverable error.
  Between ticks the session stays warm and HEAD stays on `develop`.
- Keep the idle wake-up line short so *"still watching, nothing open"* is easy to
  tell apart from *"picked up P###"*.

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
