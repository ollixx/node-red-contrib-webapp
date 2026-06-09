---
id: P34
title: "Full-journey CRUD E2E from the home route + dead-control guard, fix to green"
epic: aspects/test-infra
status: done
dependencies: [P33]
---
# P34 — Full-journey CRUD E2E from the home route + dead-control guard, fix to green

## Result

**Delivered:** Fixed gen-example.js to wire the two dead navigation buttons (homeGoToCustomersButton and backToCustomersButton) directly to the goToCustomers ui-action node, and removed 3 truly orphaned ui-action nodes (openCustomerEditor, saveCustomer, refreshCustomers — dialog open/close is handled via dialogStore; refresh via fnRefreshCustomers). Kept closeCustomerEditor as it is the dialog-header Close link source (findDialogCloseAction). Regenerated examples/customers-crud/flow.json and .node-red-dev/flows.json via pnpm gen:example (now 46 nodes, down from 50). Rewrote tests/e2e/customers-crud.spec.ts with 12 tests: 9 live-app tests (full journey home→list→CREATE→READ→BACK→UPDATE→DELETE plus individual cases), 2 structural guard tests (no dead button/table wires; no orphaned ui-action), and 1 dev/E2E parity test (flow.json matches gen-example output). All waitForTimeout calls removed — every wait is on a real condition (network response, element state, element text).

**Stats:** 3 files changed (scripts/gen-example.js, tests/e2e/customers-crud.spec.ts, examples/customers-crud/flow.json + .node-red-dev/flows.json). 12 E2E tests (up from 5), all green in 3 consecutive runs (determinism verified). Unit suite: 174 tests, 0 failures. pnpm validate green.

**Notes:** closeCustomerEditor ui-action is exempt from the 'must have feeder' rule because it is self-sourced: findDialogCloseAction renders a Close link in the dialog header with data-webapp-source=closeCustomerEditor, so the browser fires events on it directly. The structural guard codifies this exception. The UPDATE test also verifies the row count stays at 3 (not appended) to guard against create-instead-of-update regressions.

**Cost:** session 01b16d5f-2c46-44d3-8807-d7dbf0d7a90c, 10m (2026-06-02T07:44:04Z → 2026-06-02T07:54:00Z)
