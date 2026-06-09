---
id: P36
title: "App shell — a token-themed application chrome for the `app` layout preset"
epic: aspects/layout
status: done
dependencies: [P34]
---
# P36 — App shell — a token-themed application chrome for the `app` layout preset

## Result

**Delivered:** Implemented a complete application shell for apps using the `app` layout preset. The shell is rendered entirely through the existing app layout (header/navbar/content/footer slots) plus design tokens—no new dependencies or components. The server now renders a top app bar with the ui-app title, themed via the --wa-color-primary token (no hard-coded colors). All slot regions are frameless: the .webapp-slot CSS rule carries no border or background, with structure derived from whitespace and type hierarchy instead. The navbar collapses sensibly on narrow viewports (stacked above content on mobile, sidebar on desktop). Updated customers-crud example: its routes now use app layout (not vertical), and a navbar button mounts to the app-level navbar slot. Added 12 unit tests and 6 E2E tests validating shell structure, token-driven styling, frameless design, and responsive behavior. Updated ADR 0002 documentation with the shell contract.

**Stats:** 5 files modified (nodes/webapp.js: CSS + app bar rendering; scripts/gen-example.js: layout updates + navbar node; examples/customers-crud/flow.json regenerated; tests/e2e/p35-gen-hygiene.spec.ts layout expectations updated; ADR 0002 extended). 2 new test files: packages/runtime/test/p36-app-shell.test.ts (12 tests), tests/e2e/p36-app-shell.spec.ts (6 tests). Unit suite: 186 tests, 0 failures. E2E: 6 P36 tests, 0 failures (plus 50 other tests passing). pnpm validate green.

**Notes:** No new node types, no new packages. The app bar is rendered as a sibling to the webapp-grid root, so the thin client's morph() never touches it—the server's initial app bar is always visible, never overwritten by hydrate(). App-level navbar components must use the explicit layout:app/navbar mount syntax (not appId.navbar) to be discovered by the renderer's mount matcher. P35 test expectations updated: routes are now app layout, not vertical, so placement prop validation was adjusted accordingly. All P36 tests pass individually and as part of the full test suite.
