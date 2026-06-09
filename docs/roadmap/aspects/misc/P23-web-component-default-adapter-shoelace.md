---
id: P23
title: "Web Component default adapter — Shoelace"
epic: aspects/misc
status: done
dependencies: [P22]
---
# P23 — Web Component default adapter — Shoelace

## Result

**Delivered:** Added the default Web Component adapter (packages/renderer/src/shoelace-adapter.ts): a pure, framework-neutral mapping of each semantic component kind to a Shoelace (MIT) custom element with semantic prop->attribute mapping (button variant primary/secondary/danger/ghost/link -> Shoelace variant; the five semantic sizes collapsed onto Shoelace's three), graceful <div data-wa-fallback> rendering for kinds without a 1:1 element (e.g. stepper), and a --wa-* -> --sl-* token bridge (buildShoelaceTokenBridgeCss) so DesignTokens reach the components natively with no per-token translation. nodes/webapp.js now renders containers and the dialog as <sl-card>, injects buildDesignTokenCss(app.tokens) + the bridge + webapp-default token fallbacks into the page head, and loads Shoelace via a CDN ES-module autoloader (no bundler). The thin client (resources/lib/webapp-client.js) mirrors the same sl-card markup so a hydration re-render does not swap element kinds. ui-app tokens now flow through mapConfig (parseTokens); the customers-crud fixture carries a primary token.

**Stats:** Renderer: 1 new source file + index export, 1 new unit test file (6 tests; renderer now 10). webapp.js + webapp-client.js + gen-example.js + flow.json + theming.md touched. 1 new E2E spec (3 tests, order-independent). All unit suites green (schema 79, runtime 123, editor 10, renderer 10); lint clean.

**Notes:** Scope decision: leaf interactive controls (button/input/table/links) stay native HTML so accessibility and the role-based E2E selectors keep working and the no-JS fallback survives; the WC adapter is applied to the container/card shell + dialog, which is where the customers example has a container. Shoelace is loaded from jsDelivr CDN as an ES module autoloader — matches ADR 0002's 'ES modules / static resource, no bundler' and is reachable in the sandbox; a future fully-offline run may want a vendored copy. PRE-EXISTING red E2E baseline persists (layout-apps, editor-mount-options, p16d x5, parent-selector, p15, p21 customer-detail, customers-crud): root-caused as a shared-Node-RED-instance test-isolation defect — layout-apps deploys a demo app over the shared customersApp flow and its afterEach restore does not reliably persist, so alphabetically-later specs see 'Unknown app'. Confirmed identical failure set with and without P23 (full baseline run pre-change). P23's own spec re-deploys examples/customers-crud/flow.json in beforeEach so it passes deterministically regardless of order; fixing the suite isolation is out of phase scope (logged in friction-log + spun off). gen:example was re-run because the ui-app gained a tokens field.
