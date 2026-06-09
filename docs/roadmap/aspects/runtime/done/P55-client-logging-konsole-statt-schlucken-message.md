---
id: P55
title: "Client-Logging — Konsole statt Schlucken + Message-Tracing"
epic: aspects/runtime
status: done
dependencies: [P54]
---
# P55 — Client-Logging — Konsole statt Schlucken + Message-Tracing

## Result

**Delivered:** Added a shared console logger to webapp-client.js replacing all silent catch blocks with contextual warn/error logs, message tracing at DEBUG for all in/out SSE frames and event POSTs, lifecycle INFO logs on SSE connect/disconnect, and a receiving-end handler for backend-forwarded ADR-0006 error frames on the SSE 'error' event.

**Stats:** 1 client file changed (+363/-14 net), 1 new E2E spec (5 tests), 2 test helper fixes (baseline); 231/231 E2E green, 219/219 unit green

**Notes:** Fixed two pre-existing E2E fragilities: (1) webapp-page.ts navigate() now waits for SSE stream response headers so command-only flows are not dropped; (2) node-editor-page.ts openNode() has a reload-once fallback for the admin-API/editor-load race. SSE 'error' event disambiguates native EventSource connection failures (no .data) from backend-forwarded structured error frames (have .data) per ADR 0006 §4; a __webappClientTestHooks.handleServerError hook enables E2E testing without SSE stream interception.

**Cost:** session b3vnu33c1, 86m
