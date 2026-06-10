# Agent Entry Point
<!-- project-specific — belongs in this repo, not in agent-os -->

Read this file first. Then read only what your current task requires.

## Quick orientation

| File | Read when |
|---|---|
| `docs/roadmap/INDEX.md` | Always — find the current phase (first **pending** package under "Open work" whose dependencies are all `done`); then open that package file under `docs/roadmap/<epic>/` for the full contract |
| `.ai/agents/architecture.md` | Before any implementation — know the package boundaries and stop conditions |
| `.ai/agents/validation.md` | Before marking any phase done — three-step self-validation protocol |
| `.ai/agents/roadmap-phase-schema.md` | Before writing or implementing any node phase — the mandatory phase contract (verbatim `findings`, observable `acceptance`, `verify: browser`, `spec` + test-catalogue `tests` references) |
| `.ai/agents/node-testing.md` | Before writing tests for any `ui-*` node — the mandatory Node-RED node testing standard (unit + Playwright; per-node fresh tests; outcome-based; per-node test catalogue `.md`) |
| `.ai/agents/context-budget.md` | Before reading any file — know the minimum file set for your role |

Do not read `prd.md` or `docs/implementation-plan.md` unless explicitly instructed. The roadmap is the source of truth.

## Non-negotiable rules

1. Work on exactly one roadmap phase at a time.
2. Update the package's `status` (in its `docs/roadmap/<epic>/<id>-*.md` frontmatter) when a phase starts (`in_progress`), completes (`done`), is parked (`deferred`, with a `deferred_reason`), or is blocked (`blocked`); keep `docs/roadmap/INDEX.md` in sync. Schema: `.ai/agents/roadmap-phase-schema.md`.
3. Never overwrite user changes unless explicitly asked.
4. Minimal-invasive patches only — no unrequested reformatting or restructuring.
5. Flow files — `examples/customers-crud/flow.json` is **generated** by `pnpm gen:example`. Do not hand-edit it. After any phase that renames or adds node fields, run `pnpm gen:example` as the final step. See `.ai/instructions/flow-files.instructions.md`.
   **`.node-red-dev/flows.json` is the owner's personal dev environment and is completely off-limits for agents.** Never read, write, or regenerate it — not even via `pnpm gen:example`. Changes to the dev flows are the owner's responsibility alone.
6. Before any new code: commit existing uncommitted changes with a meaningful message.
7. Before marking a phase done: run `pnpm test` and `pnpm exec playwright test`. Both must pass.
7a. **Node tests follow `.ai/agents/node-testing.md`.** For any phase that builds or changes a `ui-*` node, the node's tests are written **fresh** to that standard (unit + Playwright, outcome-based) and the node's **old tests are discarded** — this does **not** apply to cross-cutting/feature tests. A "renders without crashing" / DOM-presence-only test is never acceptable, and a per-node test-catalogue `.md` is kept current.
8. When marking a phase done: append a `## Result` section to the **package file** (delivered / stats / notes / cost), flip its frontmatter to `status: done`, and **`git mv` it into its epic's `done/` subfolder** (status maps to folder — see `.ai/agents/roadmap-phase-schema.md`); fix its relative body links for the new depth and remove it from INDEX "Open work" + bump the epic's done rollup. Likewise a package set to `deferred` moves to `<epic>/deferred/`. `pnpm check:roadmap` validates all links and the move — run it before committing. Format see `.ai/prompts/run-next-phase.prompt.md`. **Under the orchestrator these roadmap writes are done by the orchestrator, not the sub-agent** — the sub-agent works in a git worktree, commits only code to its `phase/<id>` branch, and *reports* the result back. See the orchestrated division of labour below.
9. If a phase uncovers an unresolved architecture decision: write it down in the **package file** as a `blocker` (and set `status: blocked`) and stop. Resolving it is a separate task — see the roadmap-evolution role below.
10. **Result accounting — every agent, every run.** Token usage is captured **automatically**: a `SessionEnd` + `SubagentStop` hook (`.ai/hooks/record-run-cost.js`, wired in `.claude/settings.json`) reads the run's transcript and appends the real token totals + duration to `.ai/agent-runs.jsonl`, keyed by `session_id`. You do not estimate tokens. Your job in your result (a phase `summary`, an orchestrator return line, a bug-fix or validation report) is to make your run **correlatable and time-stamped**:
    - **`session_id`** — your session id, so the authoritative token row in `.ai/agent-runs.jsonl` can be matched to this result.
    - **`duration`** — measured wall-clock. Capture a UTC timestamp at the start of your run (`date -u +%FT%TZ`, e.g. when you set the phase `in_progress`) and another when you finish; report the elapsed time. (If you also want a token figure inline, read it from `.ai/agent-runs.jsonl` for prior runs — your own lands there only after you stop.)

    Phase work writes this into the archive `summary.cost` block (format in `.ai/prompts/run-next-phase.prompt.md`); non-phase roles append it to their report. Keep it to one line. See `.ai/hooks/README.md` for the log format.

11. **Specs and packages must be implementation-complete — a coding agent must not have to interpret.** This is the most common cause of a feature being half-built or built wrong: the source description was too terse.
    - **Node requirement docs (`docs/nodes/**`)** describe, **per field**: type, allowed values/options, default, accepted binding kinds (for typedInputs), per-backend support (and the warning shown when unsupported), validation rules + the error shown on violation, dependencies on other fields, and the **observable rendered effect**. No keyword stubs.
    - **Work packages (`docs/roadmap/**`)** follow `.ai/agents/roadmap-phase-schema.md`: `findings` verbatim, `acceptance` concrete and observable, `verify: browser` for UI. A package must be buildable from its own text without guessing.
    - **When the owner's input is too terse to meet this bar, STOP and ask.** Do not fill gaps by interpretation. Clarify, then write the detailed spec/package. Asking is always preferred over guessing.

## Roles

Different tasks use different entry prompts. Start from the right one:

| Task | Entry prompt |
|---|---|
| Implement a single phase (one fresh session) | `.ai/prompts/run-next-phase.prompt.md` |
| Run many phases — context-efficient | `.ai/prompts/run-roadmap-orchestrated.prompt.md` |
| Only validate a completed phase | `.ai/prompts/validate-phase.prompt.md` |
| Only write missing tests for a phase | `.ai/prompts/write-tests.prompt.md` |
| Fix a bug / regression that is not a phase | `.ai/prompts/fix-bug.prompt.md` |
| Turn a decision into an ADR + new phases | `.ai/prompts/evolve-roadmap.prompt.md` |
| Audit the agent-OS itself (fable if available, else opus) | `.ai/prompts/review-agent-os.prompt.md` |

For running multiple phases, use the **orchestrated** mode: it spawns one fresh sub-agent per phase so implementation detail never accumulates in the driving session. Model choices in the prompts are **preferences with fallbacks** (e.g. fable → opus), never hard requirements — availability changes over time.

**Orchestrated division of labour (concurrency-safe).** Each phase sub-agent runs in its own git **worktree** (`isolation: "worktree"`) on a `phase/<id>` branch and commits **only code** there. The **orchestrator is the single writer** of `docs/roadmap/INDEX.md` and the package files' lifecycle (status/result): it runs `pnpm check:roadmap` (the read-only tripwire) **before** selecting the next phase and **at** close-out, sets the package `in_progress` before spawning, and after the sub-agent reports back it merges the branch, appends the package's `## Result`, flips `status: done`, and updates INDEX. A sub-agent must **never** edit the roadmap/INDEX files. Because each package is now its own file, only INDEX is a shared writer (orchestrator-only, serial on the main branch); worktrees stay isolated — so a second session or a parallel independent phase cannot clobber the run. Details: `.ai/prompts/run-roadmap-orchestrated.prompt.md`.

**Phase work vs. maintenance work.** The numbered rules above (one phase at a time, status updates, archive on done) govern *roadmap-phase* work. Bug fixes and roadmap evolution are not phases: they skip the phase-status bookkeeping but still obey the universal rules — test-first, commit hygiene, minimal-invasive patches, never overwrite user changes. Use the dedicated prompts above. If a bug fix reveals that the roadmap itself is wrong, hand off from `fix-bug` to `evolve-roadmap`.

**Friction log.** When something in this agent-OS or the docs slows you down, misleads you, or causes rework, append one line to `.ai/friction-log.md` before you finish. It is the raw material the `review-agent-os` role mines to keep the OS honest — an empty log makes a cold audit blind.

When implementing phases that add new node types (P16a-d or similar), invoke the `/node-red-node` skill first — it contains the complete four-file pattern, code templates, and checklist so the agent does not need to read existing node files to derive the pattern.
