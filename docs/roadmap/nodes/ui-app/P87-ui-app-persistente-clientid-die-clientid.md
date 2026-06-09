---
id: P87
title: "ui-app: persistente clientId — die clientId wird heute bei Browser-Reload neu generiert, wodurch per-Client-State verloren geht. Erste clientId im localStorage persistieren und bei Reload/Reconnect wiederverwenden"
epic: nodes/ui-app
status: done
dependencies: [P15]
node: ui-app
spec: docs/nodes/structure/ui-app.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P87 — ui-app: persistente clientId — die clientId wird heute bei Browser-Reload neu generiert, wodurch per-Client-State verloren geht. Erste clientId im localStorage persistieren und bei Reload/Reconnect wiederverwenden

## Result

**Delivered:** Persisted clientId in localStorage under 'webapp:clientId:<appId>' in webapp-client.js so per-client server state (P15 clientStateMap) survives browser reload; falls back silently to ephemeral id when localStorage is unavailable.

**Stats:** 1 source file changed (resources/lib/webapp-client.js); 2 test files added (tests/e2e/nodes/structure/ui-app.spec.ts rewritten fresh, ui-app.tests.md catalogue created); 8 E2E tests total (6 pre-existing outcomes + 2 new P87 persistence outcomes)

**Notes:** Worktree was pre-created from an old initial commit; merged develop via fast-forward before starting. The data-webapp-client-id attribute path (set by server) still takes priority over localStorage for server-driven overrides. No schema/runtime change needed — this is client-only. E2E tests (Playwright) must be run by the orchestrator from the main checkout.


**Cost:** session a1b9d5c6-8aba-419a-92c5-2a9a194639c4, 12m
