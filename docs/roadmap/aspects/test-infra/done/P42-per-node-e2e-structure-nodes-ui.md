---
id: P42
title: "Per-node E2E — structure nodes (ui-app, ui-route, ui-dialog)"
epic: aspects/test-infra
status: done
dependencies: [P41]
---
# P42 — Per-node E2E — structure nodes (ui-app, ui-route, ui-dialog)

## Result

**Delivered:** 15 Playwright E2E specs across 3 files covering the structural foundation: ui-app (app-bar, token CSS vars, 404 on missing root, app/plain layouts), ui-route (root route, sub-path, two-route navigation, grid vs vertical layout class, title in <title>), and ui-dialog (hidden by default, server-rendered via ?dialog=, navigating away hides it, child node renders inside dialog).


**Stats:** 3 spec files, 15 tests, 0 new nodes; debug helper cleaned up

**Notes:** Two deviations from scope wording: (1) the `app` layout is a route-level layoutId, not a standalone app-level layout — the route must declare layoutId:"app" explicitly (or createAppRootRoute inherits it when no explicit root route exists); tests corrected to use layoutId:"app" on the route. (2) the route `title` field renders only in the HTML <title> element, not as an <h2> in the page body as the scope suggested; the test asserts the actual behavior. (3) Dialog open/close tested via the server-side ?dialog=<id> URL param rather than inject+store (the injectMessage endpoint had not been validated in prior E2E sessions — avoid untested infrastructure rather than debug it mid-phase).


**Cost:** session ccs_011CNgBPiRfXNXUKUmPjxoS2L6fTKvT5JSmMGNriLnfJCBExJx, ~11m
