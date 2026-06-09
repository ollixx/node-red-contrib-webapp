---
id: P40
title: "Token editor dialog — visual design-token editor in ui-app node"
epic: nodes/ui-app
status: done
dependencies: [P36]
node: ui-app
spec: docs/nodes/structure/ui-app.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P40 — Token editor dialog — visual design-token editor in ui-app node

## Result

**What:** Added a "Styles anpassen" button to the ui-app node editor that opens a jQuery UI
dialog with all 17 design tokens grouped into Colors, Typography, Spacing, and Radii.
Color tokens show a live colour swatch + <input type="color"> + hex text field with
bidirectional sync. Non-colour tokens use plain text inputs. Values are serialised
to a hidden #node-input-tokens field as a JSON string on dialog OK; empty values are
stripped so unchanged tokens fall back to CSS defaults. The existing parseTokens()
in webapp.js already handled both object and JSON-string inputs — no changes required
to the runtime.


**Files_changed:** nodes/structure/ui-app.html

**Validation:** pnpm validate passes (lint + 298 unit tests + build),54 Playwright E2E tests pass
