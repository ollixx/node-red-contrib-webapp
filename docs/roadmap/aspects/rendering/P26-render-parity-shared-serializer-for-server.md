---
id: P26
title: "Render parity — shared serializer for server and thin client"
epic: aspects/rendering
status: done
dependencies: [P25]
---
# P26 — Render parity — shared serializer for server and thin client

## Result

**Delivered:** Extracted one shared snapshot serializer (resources/lib/webapp-serializer.js) — a UMD module loadable both in Node (CommonJS require) and in the browser (window.WebappSerializer, served statically from resources/). It turns a RenderSnapshot into the canonical Shoelace markup (sl-button/sl-input/sl-select/sl-checkbox/sl-radio-group/sl-switch/sl-textarea/sl-range/sl-alert/sl-badge/sl-progress-bar/sl-breadcrumb/sl-tab-group/sl-details/sl-menu/sl-avatar/sl-card) plus the semantic fallbacks (text→div.webapp-text, table→real <table>). nodes/webapp.js now delegates renderLayoutHtml/renderRegionHtml/renderComponentHtml (and dialog rendering) to the shared module; resources/lib/webapp-client.js dropped its entire bespoke renderer and renders through the same module. Interactivity is unified on data-webapp-* attributes (role stays button) so the thin client intercepts clicks/submits and dispatches via POST /event without a full-page navigation, and a hydrate/re-render emits byte-identical markup — no more sl-button→native-button downgrade. collectFormValues now reads Shoelace custom elements (sl-input et al.) as well as native controls. Removed the dead branch `return region.regions ? false : false` in the client's regionContainsInput. The server page now loads webapp-serializer.js before webapp-client.js.

**Stats:** 1 file added (resources/lib/webapp-serializer.js), 3 files changed (nodes/webapp.js, resources/lib/webapp-client.js, packages/runtime/test/p21-snapshot-render.test.ts), 1 new test file (packages/runtime/test/p26-render-parity.test.ts, 4 tests incl. jsdom hydrate + no-swap morph regression). jsdom added as a devDependency. Unit suite: 166 tests, 0 failures.

**Notes:** Interactivity model decision: buttons/links/dialog-close use data-webapp-* (NOT href), so the thin client (P22 transport) drives all updates and role stays 'button' — this is what keeps the P22 e2e green (click → no navigation) and is required for the no-downgrade goal. A first attempt used href/formaction (no-JS navigation) but that made buttons role 'link' and broke the P22 dispatch tests; reverted. The /action GET route still exists but the served markup no longer wires to it. Dialog close action is still the hard-coded 'closeCustomerEditor'/'cancelCustomerButton' pair, passed generically as closeAction/closeSource into the shared renderDialogHtml — de-hardcoding it is P27. E2E: the full playwright run has a pre-existing failure set on the P25 baseline (editor specs flakily render a bare Node-RED editor with the palette unregistered; customers-crud + p21-detail-route depend on the hard-coded preview wiring owned by P27/P28). Verified by stash-and-rerun that those specs fail identically without P26; P26 introduces no new e2e failures and turns the render specs p22 (was red after the first attempt) and p23 green. See .ai/friction-log.md.
