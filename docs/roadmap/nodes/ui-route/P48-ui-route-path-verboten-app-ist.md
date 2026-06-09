---
id: P48
title: "ui-route path '/' verboten — app ist die implizite Root-Route"
epic: nodes/ui-route
status: done
dependencies: [P47]
node: ui-route
spec: docs/nodes/structure/ui-route.md
tests: tests/e2e/nodes/structure/ui-route.tests.md
---
# P48 — ui-route path '/' verboten — app ist die implizite Root-Route

## Result

**Delivered:** Enforced the invariant that a ui-route node may never use path '/' (reserved for the implicit ui-app root route); home content now mounts directly into the ui-app's slots (appId.content).

**Stats:** ~45 files; +5 schema unit tests, +1 editor E2E test; 313 unit + 216 E2E green; 34 per-node examples + customers-crud/flow.json regenerated.

**Notes:** Schema seam: added routeNodePathSchema (= routePathSchema refined to reject '/') and applied it to uiRouteNodeDefinitionSchema.path ONLY. routeDefinitionSchema.path keeps routePathSchema because the compiled AppModel legitimately contains the implicit root route (id === appId, path '/', via createAppRootRoute) and navigation destinations (navigationDefinitionSchema.to) may still target '/'. Editor: ui-route.html path field gains a validate() rejecting '/'; webapp.js already surfaces schema failures as a red node-status + node.error at deploy. FlowBuilder defaults mount to `${appId}.content` when no route and throws on route('/'); tab label 'E2E'→'Flow'. Migrated customersCrudNodeSetFixture (dropped routeHome, remounted to customersApp.content) and the dependent runtime tests. Both generators (gen-node-examples.js, gen-example.js) drop their '/' routes. NOTE/tech-debt: examples/composite/ui-toast.json is a stale ORPHAN (not produced by any generator) still containing a '/' ui-route — flagged for separate cleanup, not consumed by tests. FRICTION+FIX: `pnpm gen:example` used to auto-overwrite the off-limits .node-red-dev/flows.json; it clobbered the owner's dev flows once before this was caught. The dev-copy is now opt-in behind WEBAPP_GEN_DEV=1 so gen:example is safe by default. Owner should restore dev flows from .node-red-dev/.flows.json.backup if needed (agents cannot touch that file).


**Cost:** session a0ef64cc-0d56-43b8-a170-42191e3d46ff, 2026-06-06T11:54:51Z → 2026-06-06T12:22:21Z (~27m)
