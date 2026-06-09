---
id: P75
title: "Bugfix: ui-breadcrumb/ui-menu `navigate`-Output-Event nicht emittierbar — kein `events`-Array im Schema, kein Output-Port. Events-Contract + Dispatch ergänzen (oder Doku-Erwartung klären) + E2E"
epic: aspects/test-infra
status: done
dependencies: [P16c]
---
# P75 — Bugfix: ui-breadcrumb/ui-menu `navigate`-Output-Event nicht emittierbar — kein `events`-Array im Schema, kein Output-Port. Events-Contract + Dispatch ergänzen (oder Doku-Erwartung klären) + E2E

## Result

**Delivered:** ui-breadcrumb and ui-menu now emit the documented `navigate` output event on item click — schema events contract, mapConfig events array, serializer click hooks (data-webapp-navigate-path on navigable items), and client dispatch of navigate{params.path}.

**Stats:** 7 files changed + 1 new test file; +3 schema tests, +8 runtime unit tests, +3 E2E tests (2 breadcrumb/menu navigate + 1 no-hook assertion); 624 unit + 296 E2E all green.

**Notes:** events:['navigate'] is set unconditionally in mapConfig (output port always present per docs), not editor-configurable. Breadcrumb: navigable = item has `path` AND not the last item; menu: navigable = no external `href` AND has `route`/`path`. Client preventDefaults and only REPORTS the navigate event (params.path) — it performs no navigation itself; the wired flow drives the route change, matching events.md. No doc changes needed (impl now matches spec).


**Cost:** session 31698b98-558f-4ac6-81ff-e78df58084f6, 16m
