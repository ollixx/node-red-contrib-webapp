---
id: P37
title: "Auto-refresh on redeploy — SSE redeploy event triggers browser reload"
epic: aspects/state
status: done
dependencies: [P36]
---
# P37 — Auto-refresh on redeploy — SSE redeploy event triggers browser reload

## Result

**Delivered:** Hooked RED.events.on('flows:started') in nodes/webapp.js to emit a named SSE event 'redeploy' (empty payload) to every active subscriber. Added source.addEventListener('redeploy', ...) in webapp-client.js subscribe() that calls window.location.reload(). A guard flag (hydrated) prevents a reload loop on fresh page load before initial hydration completes.

**Stats:** 2 files modified (nodes/webapp.js, resources/lib/webapp-client.js). No new tests required (P37 scope explicitly excluded test changes). Unit suite: 186 tests, 0 failures. pnpm validate green.

**Notes:** The hydrated flag was already present from P36. The redeploy listener is added after the existing snapshot/command listeners so ordering is consistent.
