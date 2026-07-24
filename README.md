# node-red-contrib-webapp

**Build real web apps in Node-RED — declaratively.** A set of `ui-*` nodes that
let a flow *describe* a web app's structure (apps, routes, dialogs, layouts,
inputs, tables, state) instead of imperatively wiring UI components together.
The runtime compiles that description into a live, multi-client web app served
straight from your Node-RED instance.

- **Declarative structure, not wires.** UI hierarchy is expressed with each
  node's **mount**/**parent** field (`route:/customers/content`). Wires carry
  data and events only — never layout.
- **Server-rendered + live.** Pages render on the server and update in place
  over a live stream as your stores change. No separate front-end build.
- **Batteries included.** ~40 nodes: inputs, tables, lists, dialogs, tabs,
  navigation, a small state/query layer, and a reusable-component system.
  UI is built on a strictly-local vendored [Shoelace](https://shoelace.style/)
  (no CDN, offline-robust — [ADR 0008](docs/adr/0008-self-hosted-shoelace-assets.md)).

## Install

**Via the palette manager (recommended):** in the Node-RED editor open the menu
(☰) → **Manage palette** → **Install**, search for `node-red-contrib-webapp`,
and click **Install**.

**Via npm:** in your Node-RED user directory (usually `~/.node-red`):

```bash
npm install node-red-contrib-webapp
```

Then restart Node-RED. The palette shows the new `ui-*` nodes (grouped under
*webapp*). Requires **Node-RED 4.x** and **Node.js ≥ 18.5**.

## A 60-second example

1. Drop a **`ui-app`** node on the canvas — it is the root and defines the URL
   your app is served under (keep the default `app` layout).
2. Add a **`ui-text`** node; in **Parent Slot** pick your app's **content**
   slot and set the text to `Hello from Node-RED!`. It lives inside the app
   because of its **mount**, not because of any wire.
3. **Deploy**, then open `http://localhost:1880/webapp/<your-app-id>/` (the app
   node's info sidebar shows the exact URL). You see your rendered page — served
   and rendered by Node-RED itself.

The full guided version (welcome page + a button that navigates to a second
page) is in [**Getting started**](docs/guide/getting-started.md), with an
importable flow.

## Documentation

- **[User Guide](docs/guide/README.md)** (English canonical, German mirror) —
  task-oriented, example-driven:
  - [Introduction](docs/guide/introduction.md) — the core model on one page
  - [Getting started](docs/guide/getting-started.md) — install, first app,
    first deploy
  - Topic guides: [Layout & Slots](docs/guide/guides/layout-slots.md) ·
    [Bindings & State](docs/guide/guides/bindings-state.md) ·
    [Actions & Events](docs/guide/guides/actions-events.md) ·
    [Navigation & Dialogs](docs/guide/guides/navigation-dialogs.md) ·
    [Displaying data](docs/guide/guides/displaying-data.md) ·
    [Forms](docs/guide/guides/forms.md) · [Auth](docs/guide/guides/auth.md) ·
    [Theming & Components](docs/guide/guides/theming-components.md)
  - **Node reference** — one page per node under
    [`docs/guide/nodes/`](docs/guide/nodes/ui-divider.md)
- **Reference app:** [`examples/customers-crud`](examples/customers-crud/README.md)
  (importable [`flow.json`](examples/customers-crud/flow.json)).
- **Upgrading from a pre-1.0 build?** See the
  [1.0 migration notes](docs/guide/migration-1.0.md) — the breaking renames
  are auto-migrated on open/save; nothing to do by hand.

## Authentication

The nodes operate behind Node-RED's own HTTP layer and support a
**trusted-header** model: a reverse proxy (or Node-RED middleware) authenticates
the request and passes the identity via a header. That identity is then
available to your flows through the **`user` binding**, and routes/dialogs can be
gated with **`requiresGroup`** guards. See the
[Auth guide](docs/guide/guides/auth.md) for the full model and configuration.

## For contributors

This repo is a pnpm workspace of TypeScript packages
([`packages/schema`](packages/schema), `runtime`, `renderer`, `editor`) plus the
Node-RED node registrations under [`nodes/`](nodes). See
[AGENTS.md](AGENTS.md) and the
[architecture overview](docs/architecture-overview.md).

```bash
corepack pnpm install
corepack pnpm validate                 # build + lint + test + tripwires
corepack pnpm example:customers-crud   # schema + runtime + renderer smoke
corepack pnpm smoke:pack               # pack, install into a fresh dir, render-assert
```

## License

[MIT](LICENSE) © Oliver Charlet
