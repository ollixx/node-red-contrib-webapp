---
id: P54
title: "ADR 0006 Error-Handling + gemeinsames Fehler-Modell (Contract)"
epic: aspects/schema
status: done
dependencies: [P47]
---
# P54 — ADR 0006 Error-Handling + gemeinsames Fehler-Modell (Contract)

## Result

**Delivered:** ADR 0006 (error-handling & logging architecture) plus the shared structured error/log contract in packages/schema — errorSeveritySchema (debug|info|warn|error), errorOriginSchema (client|server), errorContextSchema, structuredErrorSchema with inferred types, exported as the single source of truth for P55–P57. Foundation only, no behaviour wired.

**Stats:** 4 files changed (1 new ADR, contracts.ts, index.ts, schema.test.ts) + friction-log; 9 new unit tests; 0 new nodes.

**Notes:** Pure-foundation phase: contract + types only, no runtime/client wiring, so the E2E suite is unchanged (216/216 green). Design decisions recorded in the ADR: messages authored inline keyed by a stable `code` (central catalog deferred until i18n/reuse forces it); backend→frontend forwarding is opt-in per ui-app, default OFF, severity-thresholded and redacted, carried on a new SSE "error" event; log node named ui-log (vs ui-error/ui-debug), distinct from ui-toast (persistent inspectable log vs transient notification). context.appId/nodeId reuse identifierSchema; context defaults to {}. Worktree friction (logged): worktree was checked out on wrong base commit, recovered via `git reset --hard develop`; fresh worktree had no `.node-red-dev/`, worked around by copying only `settings.js`.

**Cost:** session a0ef64cc-0d56-43b8-a170-42191e3d46ff, 16m
