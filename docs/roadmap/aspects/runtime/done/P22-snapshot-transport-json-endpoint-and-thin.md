---
id: P22
title: "Snapshot transport — JSON endpoint and thin client runtime"
epic: aspects/runtime
status: done
dependencies: [P21]
---
# P22 — Snapshot transport — JSON endpoint and thin client runtime

## Result

**Delivered:** Added a JSON snapshot endpoint (GET /webapp/:appId/snapshot) that returns the same RenderSnapshot the HTML route serializes, and an event endpoint (POST /webapp/:appId/event) that dispatches a msg.ui-shaped event via applyPreviewAction and returns the updated snapshot. A new thin vanilla-JS client runtime (resources/lib/webapp-client.js) hydrates from the snapshot endpoint, renders into #webapp-client-root, intercepts button clicks and form submits, POSTs events, and re-renders via a keyed morph so focus/scroll survive list/state updates — no full page navigation. The client<->runtime contract is documented in docs/nodes/concepts/messages.md referencing the msg.ui format.

**Stats:** 3 source files (nodes/webapp.js, resources/lib/webapp-client.js, messages.md), 1 new unit test file (2 tests), 1 new E2E spec (3 tests) + fixture flow; 123 runtime unit tests passing; P22 E2E all green.

**Notes:** renderAppPage was refactored to extract a shared buildAppSnapshot helper so the HTML route and the JSON endpoint cannot drift. The event endpoint uses a self-contained readJsonBody middleware (no dependency on Node-RED's optional httpNode body-parser). The client runtime is served at /resources/node-red-contrib-webapp/lib/webapp-client.js (Node-RED static resources, same origin as httpNode by default) and loaded via a <script defer> tag added to the preview page; the server-rendered HTML remains the no-JS fallback. P22 used a dedicated E2E fixture flow (tests/e2e/fixtures/p22-snapshot-transport.flow.json) with button ids equal to handled preview action names because the customers-crud preview action wiring is non-functional post-P20a (typed actions emit only, no statePatch) — that is the pre-existing bug spun off in P21, NOT a P22 regression. The deprecated targetMode/target fields (dropped by mapConfig since P20a) were re-attached in the unit test's dialog action definition to exercise a real state-changing dispatch. Full E2E baseline has 10 pre-existing failures (customers-crud action flow + editor specs incl. p16d, parent-selector, layout-apps, mount-options, p21 customer-detail); confirmed identical with and without the P22 spec, so P22 introduced zero new failures. No node types or node fields added, so gen:example was not required.
