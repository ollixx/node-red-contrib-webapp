---
id: P86
title: "Klassische Verhaltens-Tests Structure/State/Behavior-Knoten: ui-app clientConnected/clientDisconnected-Emission+clientId, ui-query clientId-Routing + Pass-Through/No-Crash, ui-navigation Alias-Äquivalenz zu ui-action(navigate)+Schema-`to`; redundante Behavior-E2E (z.B. ui-action „navigate does NOT update store\") eindampfen"
epic: aspects/test-infra
status: done
dependencies: [P81]
---
# P86 — Klassische Verhaltens-Tests Structure/State/Behavior-Knoten: ui-app clientConnected/clientDisconnected-Emission+clientId, ui-query clientId-Routing + Pass-Through/No-Crash, ui-navigation Alias-Äquivalenz zu ui-action(navigate)+Schema-`to`; redundante Behavior-E2E (z.B. ui-action „navigate does NOT update store") eindampfen

## Result

**Delivered:** Classic behaviour tests for ui-app, ui-query, and ui-navigation nodes (22 new unit tests); implemented clientConnected/clientDisconnected SSE event emission from addStreamClient/removeStreamClient via new emitAppClientEvent() helper; trimmed redundant E2E test 'navigate does NOT update store' from ui-action.spec.ts.

**Stats:** 4 files changed (+495/-46); 22 new classic tests; runtime 536→558 unit; 304 E2E (−1 redundant). Orchestrator final re-verify on develop: 810 unit + 304 E2E green.

**Notes:** clientConnected/clientDisconnected were spec'd in ui-app.md but not yet implemented — P86 is the first phase to wire them. emitAppClientEvent uses positional port routing (same pattern as emitRouteLifecycleEvent); no-op when RED is unset or the app declares no events. removeStreamClient added to WebappTestSurface. The 'navigate does NOT update store' E2E was removed because it tested handler behaviour now fully covered by classic tests and relied on waitForTimeout race hacks that test-conventions.md forbids.


**Cost:** session aa4ef53d70ff24b93, 12m
