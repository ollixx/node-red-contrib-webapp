---
id: P28
title: "Rebuild the Customers CRUD example from scratch — fully declarative"
epic: aspects/foundation
status: done
dependencies: [P27]
---
# P28 — Rebuild the Customers CRUD example from scratch — fully declarative

## Result

**Delivered:** Rewrote scripts/gen-example.js to build a fully declarative Customers CRUD example. The home route (routeHome) now renders real content via mounted nodes: a heading (homeWelcomeHeading), body text (homeWelcomeBody), a navigation button to /customers (homeGoToCustomersButton), and an informational ui-alert tip (homeTipAlert). The customer detail route mounts a ui-badge (customerStatusBadge) to show customer status, so the example doubles as a visual catalogue of the Shoelace adapter components introduced in P23–P25. The ui-alert's message field was fixed to use a literal binding object ({ kind: 'literal', value: '...' }) rather than a plain string, so getBinding resolves it correctly. A new unit test (customers-crud-example.test.ts) validates that the home route renders non-empty content. The example was regenerated via pnpm gen:example producing 38 nodes in examples/customers-crud/flow.json and .node-red-dev/flows.json.

**Stats:** 3 files changed (scripts/gen-example.js, examples/customers-crud/flow.json, packages/schema/src/fixtures.ts), 1 new unit test added (home route renders non-empty content), customers-crud-example.test.ts extended to cover 21 components including homeWelcomeHeading/homeWelcomeBody/homeGoToCustomersButton/homeTipAlert/customerStatusBadge. Unit suite: 174 tests, 0 failures.

**Notes:** The Playwright e2e suite was not run (requires a live Node-RED instance on :1882). All automatable validation checks pass: pnpm validate (build + lint + test), the home-route non-empty content unit test, and the consistency check (flow.json matches gen:example output). The 'manual: screenshots' criterion requires human confirmation at runtime.
