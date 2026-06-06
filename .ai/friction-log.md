# Friction Log

Raw material for the `review-agent-os` role. Whenever something in the agent-OS,
the docs, or the workflow **slowed you down, misled you, or caused rework**, append
one line here before you finish your task. Be specific and point at the file.

This is not a bug tracker for the product — it is a log of friction in *how we work*.
Newest at top. The review role mines this list and prunes entries once addressed.

Format:

```
- YYYY-MM-DD [role] what was wrong/misleading + where (file:line or path)
```

## Open owner actions

## Entries

- 2026-06-06 [run-next-phase/P49a] Orchestrated PARALLEL sub-agents collide on the E2E port. The orchestrator spawned P49a and P54 as "batch 1 parallel start", but playwright.config.ts hard-codes port 1882 (and shares /tmp/node-red-webapp-playwright.log + the global node-red bind). Each worktree's `.node-red-e2e` is isolated, but the PORT is not — so `pnpm exec playwright test` in one worktree ECONNREFUSEDs / restarts the other's server mid-run, producing false E2E failures. Either serialise E2E across parallel phases, or derive the port per-worktree (e.g. 1882 + worktree-hash offset) and the log path likewise. This cost a full re-run cycle.
- 2026-06-06 [run-next-phase/P49a] The worktree was checked out on the ancient `db4f4ff initial checkin` (pre-pnpm-workspace package.json) instead of `develop`; `git branch phase/P49a` inherited that stale HEAD. Had to `git reset --hard develop` to get the real codebase. The worktree setup should branch from the integration branch the orchestrator is on, not whatever HEAD the worktree happened to carry.
- 2026-06-06 [run-next-phase/P49a] The E2E webServer command copies `.node-red-dev/settings.js` into `.node-red-e2e`, but `.node-red-dev` (owner-only, gitignored) does not exist in a fresh worktree — so E2E cannot start there at all without symlinking it back to the main checkout. A worktree-portable settings.js (committed e2e-settings, or generated) would remove this dependency on the owner's off-limits dir.
- 2026-06-01 [run-next-phase/P33] Flow-driven dialog open does not work over the live transport: a ui-action `show`/`openDialog` command is a no-op for opening because the client only renders dialogs present in `snapshot.dialogs`, which the renderer fills only when `ui.dialogs.<id>.open===true` in STATE. `applyCommand` (resources/lib/webapp-client.js) ignores `show` entirely and `hide` only flips a client-local `dialogId` that `renderSnapshot` never reads. **Captured in P53** (ui-action verb set + ADR 0005) — prune once P53 lands.
- 2026-06-01 [run-next-phase/P33] `buildAppSnapshot` (nodes/webapp.js) picks per-client state OR broadcast state but never MERGES them: once a client has any per-client state, broadcast data updates become invisible to it. Combined with the client minting a fresh random clientId on every full page load (resources/lib/webapp-client.js, no stable id from the server), per-client CRUD state cannot survive a navigation. Open runtime limitation — a stable server-issued clientId + merging broadcast under per-client state would make per-client apps viable. Not yet phased.
- 2026-05-31 [run-next-phase/P31] Manual runtime verification needs a live node-red on 1881/1882; orphaned background instances kept owning the port so restarts silently failed to bind and curl hit stale code. `dev:start` now kills 1881 first, but the E2E 1882 path has no equivalent guard. A scripted "kill anything on 1881/1882 before starting" (or a fresh ephemeral port) would prevent the "talking to the old process" ghost.
- 2026-06-03 [P42 scope] Scope wording was aspirational, not behavioural: it said ui-route 'title renders as <h2>' (impl only sets <title>) and assumed an `injectMessage` helper that returned 404 against live Node-RED. Lesson: write `validation` against actual runtime behaviour, not desired HTML structure.
