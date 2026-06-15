# ADR 0022: per-node review videos — fixture-driven Playwright showcase + video/HTML report

- Status: accepted
- Date: 2026-06-15
- Builds on: the existing Playwright E2E harness (auto-starts Node-RED on :1882
  from fixtures; 74 per-node specs), the per-node `*.tests.md` catalogues
  (`.ai/agents/node-testing.md`). Relates to
  [[orchestrator-must-verify-e2e-in-main-checkout]] /
  [[e2e-verify-build-and-no-tail]].

## Context

Green unit tests and **headless** E2E keep missing **visual / UX** defects — the
owner repeatedly hit them by hand: a list rendered as bare `<ul>/<li>` with the
icon glued to the label, `visible`/`disabled` showing a broken empty dropdown +
"…", store fields cramped into one row. None of these failed a test; they only
showed up when a human *looked*.

Owner idea (2026-06-15): per-node Playwright tests that **simulate using the node
in Node-RED**, exercise each feature once, pull in whatever other nodes are needed,
run **in the browser**, and **record a video** the owner can watch as a review.

## Decision

### 1. Review videos via Playwright video + trace + HTML report

Turn on `use: { video: "on", trace: "on" }` and the **HTML reporter**. The HTML
report **is** the review dashboard: per-test embedded **video** + a clickable
**trace** (step-by-step DOM snapshots). No bespoke video tooling.

### 2. Fixture-driven showcase — NOT editor-build-by-clicks (owner choice)

A showcase spec **imports a prebuilt flow** (the existing fixture pattern),
deploys, then films the **running app** exercising the node's features **and**
selectively **opens the node's config dialog** so the editor fields/typedInputs
are visible on camera (this is what catches the editor-optic bugs above).

Rejected: driving the Node-RED editor by drag/drop/configure clicks to build the
flow — most literal but brittle, slow, and a maintenance sink.

### 3. Self-contained fixtures

Each showcase fixture pulls in **as many other nodes as the feature needs**
(`ui-app`/`ui-route` + the rest) so the node renders meaningfully — already how
fixtures work.

### 4. Narrated + asserting

A showcase spec is a **demo that also asserts**: paced with `test.step` chapters
(one per feature) so the video reads as a tour, while still failing on regression.

### 5. Separate on-demand target

Video/trace cost time + disk → a dedicated target (e.g. `pnpm test:showcase` /
a `--video` profile), **not** every CI run.

### 6. Phased rollout (owner choice: quick-win + pilot)

1. **Quick-win** — flip video + HTML report on for the existing suite → reviewable
   videos of every node **immediately** (near-zero effort).
2. **Pilot** — 2–3 dedicated showcase specs (`ui-list`, `ui-repeat`,
   `ui-query → ui-list`) to prove the format/pacing.
3. **Rollout** — per-node showcase specs after the pilot validates the pattern
   (tracked in each node's `*.tests.md`).

## Consequences

- **P186** (quick-win): video/trace/HTML-report config + `test:showcase` target.
- **P187** (pilot): the showcase-spec helper/pattern + the 2–3 pilot specs.
- Rollout to the remaining nodes is later, incremental work, noted per node's
  `*.tests.md`; not all authored at once.
- The review videos complement, not replace, the assertion E2E + the
  orchestrator's `verify: browser` proof.
