---
id: P56
title: "Runtime-Logging + konfigurierbarer Backend→Frontend-Fehler-Transport"
epic: aspects/runtime
status: done
dependencies: [P54, P55]
---
# P56 — Runtime-Logging + konfigurierbarer Backend→Frontend-Fehler-Transport

## Result

**Delivered:** Runtime structured logging + opt-in backend→frontend error transport (ADR 0006 §§3,4). nodes/webapp.js gained reportRuntimeError() and pushErrorToClients() — logs every framework failure with context and writes a new SSE 'error' frame gated by per-app config + severity threshold, message redacted. ui-app gained forwardErrorsToClient (bool) + forwardErrorMinSeverity (debug|info|warn|error), default OFF/error. Browser logs forwarded errors via the P55 receiving handler.

**Stats:** 9 files changed (+870/-13): schema, nodes/webapp.js, ui-app.html, 2 docs; 12 new unit tests (363 unit total); 2 new E2E (239 E2E total).

**Notes:** Schema fields are .optional() not .default() — absent = secure default (false/error), applied at the runtime read site. SSE event name 'error' + payload shape {error:{...}} consistent across server write, P55 client handler, and ADR 0006. gen:example produced no diff (fields optional, generator does not emit them).

**Cost:** session worktree-agent-ac783282a6def061f, 18m
