# Changelog

All notable changes to **node-red-contrib-webapp** are documented here. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

First public release: a declarative `ui-*` node set that compiles a Node-RED
flow into a live, server-rendered, multi-client web app.

### Added

- **~40 `ui-*` nodes** across structure (`ui-app`, `ui-route`, `ui-dialog`,
  reusable component definitions/instances), inputs (`ui-input`, `ui-select`,
  `ui-checkbox`, `ui-radio`, `ui-switch`, `ui-textarea`, `ui-datepicker`,
  `ui-slider`), display & feedback (`ui-text`, `ui-table`, `ui-list`,
  `ui-badge`, `ui-alert`, `ui-toast`, `ui-progress`, `ui-skeleton`,
  `ui-empty-state`, …), navigation (`ui-tabs`, `ui-accordion`, `ui-breadcrumb`,
  `ui-menu`, `ui-pagination`, `ui-stepper`), state (`ui-store`, `ui-query`,
  `ui-store-read`, `ui-store-action`, `ui-query-action`), and behaviour
  (`ui-action`).
- **Declarative structure** via `mount`/`parent` (now `app`) fields — wires
  carry data/events only.
- **Server-rendered pages with a live update stream**; the same snapshot
  serializer runs on server and client so they cannot drift.
- **Bindings** (literal / state / query / route-param / store) with a `user`
  binding and trusted-header auth, plus `requiresGroup` route/dialog guards.
- **Strictly-local vendored Shoelace** UI (no CDN) — see
  [ADR 0008](docs/adr/0008-self-hosted-shoelace-assets.md).
- **User Guide** (English canonical + German mirror) under
  [`docs/guide/`](docs/guide/README.md), with importable example flows, and the
  [`customers-crud`](examples/customers-crud/README.md) reference app.

### Packaging

- The published package is now a **self-contained runtime artifact**: the
  compiled `packages/*` the runtime entry loads are esbuild-bundled with their
  internal `@node-red-contrib-webapp/*` requires inlined; `zod` is the only
  external runtime dependency. (Before 1.0 an installed package failed to load —
  the compiled renderer required `@node-red-contrib-webapp/schema` by a
  workspace-only package name. See the migration notes.)
- Added an **install-smoke-test** (`pnpm smoke:pack`) that packs, installs into a
  fresh non-workspace directory, boots Node-RED, and asserts the app renders.

### Migrating from a pre-1.0 build

All breaking changes below are **auto-migrated when a node is opened and
re-saved (deployed)** — there is no manual editing step. See
[`docs/guide/migration-1.0.md`](docs/guide/migration-1.0.md) for the details.

- **`ui-navigation` removed** → use `ui-action` with `actionType: navigate`
  (mechanical replacement; [ADR 0040](docs/adr/0040-retire-ui-navigation-node-navigate-is-a-ui-action.md)).
- **Field renames** ([ADR 0038](docs/adr/0038-field-model-consistency-naming-and-carrier-normalization.md)):
  `parent → app`, `layoutId → layout`, `routeId → route`,
  `definitionId → definition`, and `ui-textarea`'s `rows → lines`.

[1.0.0]: https://github.com/ollixx/node-red-contrib-webapp/releases/tag/v1.0.0
