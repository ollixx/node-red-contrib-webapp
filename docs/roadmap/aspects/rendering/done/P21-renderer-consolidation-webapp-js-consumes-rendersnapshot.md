---
id: P21
title: "Renderer consolidation — webapp.js consumes RenderSnapshot"
epic: aspects/rendering
status: done
dependencies: [P20b]
---
# P21 — Renderer consolidation — webapp.js consumes RenderSnapshot

## Result

**Delivered:** nodes/webapp.js now renders the preview exclusively from the RenderSnapshot produced by createRendererApp (packages/renderer). The parallel render path (mountMatches, renderSlotTree, renderComponent, layoutHasInputs) was deleted; renderAppPage builds the AppModel, calls the renderer, then serializes the snapshot's regions/dialogs to HTML. Container-id mount resolution (container:<id>/slot, the form the editor emits) was added inside the renderer so all mount scopes resolve in one place.

**Stats:** 2 source files changed (nodes/webapp.js, packages/renderer/src/renderer.ts), 2 new test files (1 unit + 1 E2E), 214 unit tests + 4 new P21 E2E specs passing

**Notes:** Stop-condition #1 (mount-path parsing) was avoided: the schema mount parser was left untouched; container-id matching was added in the renderer's container matcher (createContainerMountMatcher), which also still accepts the layout:<layoutId>/slot form the typed fixture uses. The P21 deliverable wording implied the renderer already resolved container: mounts, but parseMountReference only supports route/dialog/layout — logged in friction-log. 8 pre-existing E2E failures (customers-crud action flow + 7 editor specs) were confirmed red on the untouched baseline (stash+rebuild), are unrelated to P21's rendering work, and were spun off as a separate bug-fix task. P21's own rendering criteria are covered by tests/e2e/p21-snapshot-render.spec.ts (routes, dialog, table rows, no slot-name headings).
