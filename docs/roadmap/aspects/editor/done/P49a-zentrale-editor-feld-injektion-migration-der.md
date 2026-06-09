---
id: P49a
title: "Zentrale Editor-Feld-Injektion + Migration der Grid-Platzierungs-Zeilen"
epic: aspects/editor
status: done
dependencies: [P48]
---
# P49a — Zentrale Editor-Feld-Injektion + Migration der Grid-Platzierungs-Zeilen

## Result

**Delivered:** Central editor-field injection in resources/lib/editor-common.js (generic injectFieldGroup primitive + injectPlacementRows); migrated the 7 grid placement rows out of all 28 view-node HTML templates into the single injector. Pure refactor — rendered editor panels and saved node configs unchanged.

**Stats:** 30 files changed (+121/-224): 28 node HTML files stripped of duplicated placement markup, editor-common.js gained the injector, 1 new E2E spec (placement-rows.spec.ts, 5 tests). Full suite green: 309 unit tests, 221 E2E (45 editor).

**Notes:** injectFieldGroup() is the reusable primitive P50's variant SelectBox builds on (idempotent, data-field-group marker). installLayoutChildPropRows() now injects rows, manually binds stored values from node config (Node-RED auto-bind runs before injected inputs exist), and keeps the per-layout show/hide contract. Each node keeps its `defaults` entries, so deployed configs are byte-identical (proven by round-trip-save E2E). No node fields added/renamed → no gen:example needed. Pre-existing limitation observed, NOT changed: getMountLayoutId only resolves route: form mount paths, not dot form. E2E port collision between parallel worktrees logged to friction-log.

**Cost:** session 1656913a-1e20-493e-a501-1b549d3b325a, 26m
