---
id: P32
title: "Remove the preview rendering apparatus entirely"
epic: aspects/rendering
status: done
dependencies: [P31]
---
# P32 — Remove the preview rendering apparatus entirely

## Result

**Delivered:** Removed all preview-simulation code from nodes/webapp.js: deleted applyPreviewAction, previewState/previewQueries/previewMessages maps, seedQueryDataFromConfig, getPreviewQueries, getPreviewMessages, resetPreview, rememberPreviewMessage, parsePreviewData, buildActionHref, and the /snapshot, /events, /reset, /action/:actionId HTTP endpoints. Replaced the shared previewState broadcast store with runtimeState.liveState (same semantics, honest name — no longer called 'preview'). Removed previewData from queryDefinitionSchema (packages/schema contracts + node-definitions), from the customers fixture, and from the runtime node-set assembly. Updated docs/nodes/concepts/messages.md to describe the live SSE transport instead of the snapshot/preview transport. Rewrote affected unit and E2E tests to remove preview-only assertions.

**Stats:** 15 files changed (nodes/webapp.js -200+ lines, 5 test files rewritten, 2 schema files, 1 fixtures file, 1 runtime src file, 2 E2E specs updated, messages.md rewritten). Unit suite: 174 tests, 0 failures. pnpm validate (roadmap+lint+test+build) green. E2E: 18 failed (down from 20 pre-P32), 18 passed.

**Notes:** runtimeState.previewState renamed to runtimeState.liveState — semantically the same broadcast state, just no longer named 'preview'. The previewData field is removed from webapp.js mapConfig and from the schema's QueryDefinition; ui-query nodes in the codebase no longer carry seed data (P33 will push real data from a wired flow). The /event endpoint is kept (P30) and still returns a snapshot in its response for thin-client consistency between pushes, but /snapshot as a standalone GET is gone. The schema's queryDefinitionSchema.previewData removal was accompanied by removing the field from the fixture and from node-set.ts mapping. E2E improvement: customers-crud test updated to not expect previewData rows (checks table presence only); the 2 fewer failures vs pre-P32 confirm the removal worked correctly.
