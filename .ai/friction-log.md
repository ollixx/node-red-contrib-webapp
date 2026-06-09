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

- 2026-06-09 [run-next-phase/P106] Two traps cost rework: (a) `status` is a RESERVED Node-RED node property (the runtime status indicator object) — using it as a ui-app config key made `this.status` an object and the editor select blank; renamed the config key to `deployMode` (label stays "Status"). A context-budget/node-skill pitfall note ("never name a node config field `status`/`name`/`id`/`type`/`wires`/`x`/`y`/`z` — they are reserved") would have saved a debug cycle. (b) The P37 deploy-reload was **dead code**: the `flows:started` listener lived only in `registerWebappNodes()` (the legacy factory), but Node-RED invokes nodes via `registerWebappNodes.registerNodeType` per type — the factory is never called, so the listener never registered. The comment at `nodes/webapp.js` registerNodeType already says "not the legacy registerWebappNodes factory" but nothing flagged that the factory still held a live-looking event hook. Moved the hook into `registerEndpoints` (the path that runs) with a once-guard.
- 2026-06-09 [run-next-phase/P106] `pnpm gen:example` regenerates `examples/customers-crud/flow.json` with an UNRELATED pre-existing drift (a badge fixture `variant:"status"`/`severity` → `displayType:"rounded"`/`variant` rename from an earlier phase) — running it as AGENTS.md rule 5 demands would pull that drift into an unrelated phase's commit. Reverted and skipped (my added field is optional+defaulted, so the example is unaffected). The committed flow.json is stale vs the typed fixture; worth a one-shot regen by the owner.
- 2026-06-09 [review-agent-os] Pruned this log: removed the 15+ duplicate "worktree HEAD sat at the ancient db4f4ff orphan base instead of develop" entries (P49a/P50/P53/P54/P56/P62/P64/P67/P69/P71/P90/P95/P96/P98/P99) now addressed by the new **worktree-sanity step** in run-next-phase Orchestrated mode; removed the P57 "new node kind needs 4 synced places" entry (now a context-budget pitfall) and the P42 "write validation against runtime behaviour, not desired HTML" entry (now covered by the observable-`acceptance` detail bar). **Remaining un-fixed worktree quirks** (harness-level, prompt can only partially mitigate): (a) Edit/Write require the worktree-absolute path even after Reading the shared-checkout path; (b) a sparse worktree may lack `resources/`, so unit tests that `require('../../resources/lib/…')` fail until built/copied; (c) running Playwright inside a worktree is environment-dependent (works some runs, fails others on `.node-red-dev/settings.js`) — the orchestrator runs full E2E on develop after merge regardless. Worth an owner report to the harness team if it persists.
- 2026-06-06 [run-next-phase/P49a + P31] E2E port is not isolated across parallel/concurrent runs: `playwright.config.ts` hard-codes port 1882 and shares `/tmp/node-red-webapp-playwright.log`, so two parallel worktree phases (or a stray background server) ECONNREFUSE / restart each other's server mid-run → false failures. `dev:start` kills 1881 first, but the E2E 1882 path has no equivalent guard. Fix: serialise E2E across parallel phases, or derive port+log per worktree (e.g. 1882 + hash offset).
- 2026-06-06 [run-next-phase/P52] The full Playwright suite is RAM-bound on this VM: the worker is OOM-killed (SIGKILL) partway through some runs, cascading into ECONNREFUSED for the rest; pass counts vary run-to-run (nondeterministic memory pressure, not a code defect). No repo fix, but E2E sometimes needs headroom this host lacks — re-run or run in shards when it happens.
- 2026-06-06 [run-next-phase/P54] During parallel batches, "the first pending phase whose deps are done" is ambiguous when two siblings are simultaneously `in_progress` — the scan rule alone is insufficient; the orchestrator's explicit hand-off is load-bearing. Worth making the orchestrator state the chosen phase id explicitly (it does today).
- 2026-06-06 [run-next-phase/P53] Any phase that adds an action verb or a node field must treat the **schema** as an implicit deliverable: the new verb/field is silently stripped by Zod (`contracts.ts` enum + `node-definitions.ts` node schema) until both are widened — the symptom (`Invalid option` in the node-red log, command never reaches the client) reads like a client bug.
- 2026-06-01 [run-next-phase/P33] Runtime limitation: `buildAppSnapshot` (nodes/webapp.js) picks per-client state OR broadcast state but never MERGES them — once a client has any per-client state, broadcast updates go invisible to it. (The fresh-clientId-per-load half was since fixed by P87's persistent clientId; the merge gap remains.) Making per-client apps fully viable needs broadcast merged under per-client state. Not yet phased.
