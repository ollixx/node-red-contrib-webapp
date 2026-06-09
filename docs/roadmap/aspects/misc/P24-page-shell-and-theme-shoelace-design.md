---
id: P24
title: "Page shell and theme — Shoelace + design tokens"
epic: aspects/misc
status: done
dependencies: [P23]
---
# P24 — Page shell and theme — Shoelace + design tokens

## Result

**Delivered:** Replaced the bespoke beige/serif page shell in nodes/webapp.js with a Shoelace + design-token-driven shell: removed the old :root { --bg:#f4f1e8 } block, Georgia/serif typography, .webapp-shell container class, and .webapp-topbar 'Runtime Preview' header; rewritten CSS uses --wa-* custom properties for all colours, typography, surfaces, borders and radius so the page inherits the Shoelace theme. Layout-region structure (header/navbar/content/footer slots, grid/vertical/horizontal/absolute variants) is preserved but now styled with tokens. Fixed p23-shoelace-adapter E2E test to remove the obsolete .webapp-button selector (buttons have been sl-button since the P23 follow-up commit).

**Stats:** 1 file changed (nodes/webapp.js), 1 new test file (9 unit tests), 1 E2E test file updated. Unit suite: 134 tests, 0 failures. E2E: 10 pre-existing failures (inherited from P23, root-caused as test-isolation defect — see P23 archive notes), 0 new regressions.

**Notes:** The 10 pre-existing E2E failures were confirmed present both before and after P24 (stash baseline test). P24 validation criteria are all unit-testable; the 'manual' criterion is explicitly subjective. The p23-shoelace-adapter E2E test was updated because its .webapp-button selector became stale after the P23 follow-up commit (100b774) — the update is a correctness fix, not scope creep.
