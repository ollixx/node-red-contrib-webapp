---
id: P33
title: "Rebuild Customers CRUD as a REAL wired Node-RED flow (zero framework logic)"
epic: aspects/misc
status: done
dependencies: [P32]
---
# P33 — Rebuild Customers CRUD as a REAL wired Node-RED flow (zero framework logic)

## Result

**Delivered:** Rewrote scripts/gen-example.js so examples/customers-crud/flow.json (and .node-red-dev/flows.json) is a REAL wired Node-RED flow: ui-button/ui-table outputs are wired into plain `function` nodes that hold every create/read/update/delete decision, and those function nodes are wired back into ui-store (data) and ui-action (navigate)/ui-store (dialog open) nodes. The customers list + selected customer live in a new `customersStore` (statePath `customers`); the table binds rows to state `customers.list` and the detail badge to `customers.current.status` (no query data path). A `dialogStore` (statePath `ui.dialogs.customerEditor`) lets a function node open/close the editor via state, since the live transport renders dialogs from snapshot state, not action commands. A seed inject populates flow context AND re-pushes the store, and is re-triggerable via POST /inject/seedCustomers for E2E isolation. All domain logic is in the flow's function nodes — nodes/webapp.js contains zero customer identifiers (re-asserted by grep).

**Stats:** 4 files changed (scripts/gen-example.js, examples/customers-crud/flow.json, .node-red-dev/flows.json, tests/e2e/customers-crud.spec.ts) + 3 structural wiring tests in packages/schema/test/schema.test.ts. Unit suite: 276 tests, 0 failures. customers-crud.spec.ts: 5/5 green (list/create/read/delete). pnpm validate (roadmap+lint+test+build) green.

**Notes:** Single-owner CRM demo: all store ops and navigate commands are BROADCAST (no clientId) so data survives a full-page navigation — required because the client mints a fresh random clientId per page load AND buildAppSnapshot picks per-client OR broadcast state without merging (logged in friction-log as a transport gap). The example proves the thesis: deleting the function nodes stops CRUD. E2E baseline was already red (21 specs) BEFORE this phase — editor-template-registration timing (p12/p13/p15/p16d/parent-selector/editor-mount-options) and pre-existing p21 detail (stale link-role; affordance is sl-button/role=button) + p21 ?dialog= vs SSE-snapshot + p23 — all confirmed identical on the stashed pre-P33 baseline via isolated reruns; none introduced by P33. validation.md step 1 still lacks a known-red-baseline carve-out (recurring since P21).
