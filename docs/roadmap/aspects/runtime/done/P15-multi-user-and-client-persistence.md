---
id: P15
title: "Multi-user and client persistence"
epic: aspects/runtime
status: done
dependencies: [P12]
---
# P15 — Multi-user and client persistence

## Result

**Delivered:** Added clientId routing to ui-store input handler (targeted per-client state vs broadcast), persist flag on ui-store node, and reconnect sync helper resolveReconnectState (server wins on equal/older client timestamp, client wins when newer).

**Stats:** 4 files changed (webapp.js, ui-store.html, p15 unit test, p15 E2E test), 15 new unit tests, 2 new E2E tests

**Notes:** clientStateMap added to runtimeState as appId→Map<clientId,{state,timestamp}>. Per-client state is independent of shared previewState. resolveReconnectState is exported via __test__ for unit testing. Persist flag stored on definition object; localStorage behaviour on the client side is intentionally deferred (renderer not in scope for this phase). docs check: multi-user.md sync strategy matches resolveReconnectState exactly.
