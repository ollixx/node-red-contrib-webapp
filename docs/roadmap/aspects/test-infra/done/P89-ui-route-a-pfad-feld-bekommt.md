---
id: P89
title: "ui-route: (a) Pfad-Feld bekommt Info-Button + Doku-Dialog (analog ui-app.logging); (b) Title wird Value-Feld als typedInput mit allen sinnvollen Binding-Typen (literal/state/store/query/routeParam/msg/flow/global/jsonata/env); ui-route.md anpassen"
epic: aspects/test-infra
status: done
dependencies: [P67]
---
# P89 — ui-route: (a) Pfad-Feld bekommt Info-Button + Doku-Dialog (analog ui-app.logging); (b) Title wird Value-Feld als typedInput mit allen sinnvollen Binding-Typen (literal/state/store/query/routeParam/msg/flow/global/jsonata/env); ui-route.md anpassen

## Result

**Delivered:** ui-route (a) path field gains an info-button + jQuery-UI dialog explaining path rules; (b) title field upgraded to a full typedInput binding (literal/state/store/query/routeParam/msg/flow/global/jsonata/env), back-compat with plain strings; schema, mapConfig, editor, docs, and tests updated.

**Stats:** 8 files changed; 8 new schema unit tests, 8 new runtime mapConfig unit tests, fresh E2E spec with 9 outcome-based tests (replaces P42 spec), new test catalogue; nodes/structure/ui-route.html rewritten, packages/schema/src/node-definitions.ts + nodes/webapp.js + docs/nodes/structure/ui-route.md updated

**Notes:** Dynamic bindings (state/store/msg/…) for route title resolve to undefined at compile time (server renders <title> once; dynamic update not implemented). Plain-string title back-compat preserved via mapConfig branch. routeDefinitionSchema.title kept as z.string().optional() — the compiled AppModel always holds a resolved string; only the node-definition schema and editor accept bindings. Node-testing.md fresh-test rule applied: old P42 spec replaced.


**Cost:** session a836ad36b0c5a3a7d, 14m
