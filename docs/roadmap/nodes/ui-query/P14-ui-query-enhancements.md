---
id: P14
title: "ui-query enhancements"
epic: nodes/ui-query
status: done
dependencies: [P11b]
node: ui-query
spec: docs/nodes/state/ui-query.md
---
# P14 — ui-query enhancements

## Result

**Delivered:** Removed unused source field from ui-query schema/editor/runtime; added ETag-based caching that skips push when etag unchanged; added params field binding ui-query to a ui-store for reactive refresh on store change.

**Stats:** 7 files changed, 11 new unit tests, 0 new E2E tests (no editor UI behavior change warranting E2E beyond existing coverage)

**Notes:** triggerParamQueryRefresh reads RED from runtimeState (stored on module init in registerWebappNodes). ETag cache keyed by node.id + queryPath. Store-change re-trigger sends {ui:{query:{queryPath,refresh:true}}} to dependent query nodes. Docs note ui.queries.<queryPath> as conceptual — runtime uses query.id; left as-is since doc section is explicitly marked future/concept.
