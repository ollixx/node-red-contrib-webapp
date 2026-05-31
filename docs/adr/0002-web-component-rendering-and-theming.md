# ADR 0002: Web Component rendering target and theming boundaries

- Status: accepted
- Date: 2026-05-31
- Supersedes: the renderer-framework decision in [ADR 0001](0001-initial-architecture.md) (React + React Router)

## Context

ADR 0001 locked "React in the renderer package" as a P0 default. In practice the
renderer package (`packages/renderer`) was built as a **framework-agnostic snapshot
producer**: `createRendererApp(...).render()` returns a `RenderSnapshot` — an abstract
tree of regions and components as data, plus pure data operations (`navigate`,
`replaceState`, `replaceQueries`, `dispatch`). No React was introduced. The actual
HTML is produced separately in `nodes/webapp.js` by a second, parallel renderer
(`renderAppPage`, `renderSlotTree`, `mountMatches`, `renderComponentHtml`) labelled
"Runtime Preview".

This left three unresolved questions that this ADR settles:

1. **What is the delivered frontend?** The product builds tool-style app UIs (CRUD,
   dashboards, internal tools), not public content sites. SEO and server-side
   first-paint indexing are therefore not requirements. Per-user dynamic data (e.g.
   list rows from a query) is exactly the content SEO does not help with.
2. **Where does a CSS/component framework belong, and is a "theme" purely
   presentational?** The concern: a Material theme appears to bring its own components
   (FAB, snackbar) that Bootstrap lacks — implying a theme would inject node types.
3. **What are the stable interfaces between model, theme, generator, and frontend
   library**, so that adopting Bootstrap/Material/Vuetije-style systems later does not
   require re-architecting?

A key observation from the existing code: component props are already **semantic**, not
framework-specific (`variant: count|dot|status`, `size: xs|sm|md|lg|xl`), and the node
vocabulary (~30 nodes: ui-stepper, ui-toast, ui-badge, ui-accordion, ui-breadcrumb,
ui-avatar, …) is already a Material/Bootstrap superset. The clean separation this ADR
formalises is largely already present in the data layer.

## Decision

### 1. The abstract vocabulary is theme-free and the superset; a theme injects no nodes

The node vocabulary stays semantic and framework-neutral. A node says *what* it is
("a multi-step progress" = `ui-stepper`), never *how a framework renders it*. Component
props remain semantic (`variant: primary`, `size: md`) — never framework tokens
(`variant: contained|outlined`).

A **theme does not add node types.** A theme is a triple:

- a **token set** (values: colors, spacing, radii, fonts) — declarative, on `ui-app`
- an **adapter choice** (which generator renders the snapshot) — a reference in the model
- an **adapter implementation** (the semantic→framework mapping plus fallbacks) — code in
  the relevant generator package

Switching themes = swap tokens + adapter. The flow is unchanged and portable. If a
framework lacks a native equivalent for a node, its adapter degrades gracefully to a
fallback rendering.

### 2. Stable interfaces: `RenderSnapshot` + `DesignTokens`

These two contracts (both already defined in `packages/schema` and `packages/renderer`)
are the architectural seam:

- Everything **above** the adapter (schema, runtime, renderer) knows nothing about any
  frontend framework.
- Everything **below** the adapter (the frontend library) knows nothing about Node-RED.

The snapshot is **rendering-agnostic**: the same snapshot can be turned into HTML on the
server (hypermedia / per-interaction SSR) or shipped as JSON and rendered on the client.
The architecture does not force one; the rendering *target* (the adapter) decides.

### 3. Default rendering target: Web Components, with a thin client runtime

The default adapter targets **Web Components** (Custom Elements). Rationale:

- **Framework-neutral by the platform standard** — the same components work in React,
  Vue, and plain HTML. This matches the explicit requirement that the frontend tech be
  interchangeable.
- **Complete component system out of the box** — libraries such as **Shoelace** (MIT,
  ~55 components) or **Material Web** (`@material/web`) provide Stepper, Dialog, Snackbar,
  etc., so we do not re-build a component system by hand (the gap left by a classless
  CSS approach such as Pico).
- **Theming fits natively** — these libraries are themed via CSS custom properties, so the
  existing `DesignTokens` → `buildDesignTokenCss` output plugs in directly without any
  per-token adapter translation.
- **No bundler mandate** — Web Components load via ES modules / CDN, preserving the repo's
  current zero-frontend-build shipping model. A React/Vue SPA would force a Vite/Webpack
  pipeline into a Node-RED plugin.

The client runtime is **thin vanilla JS**, not a logic framework: the renderer already
expresses state, events and navigation as pure data operations. The client loop is: hold
the current snapshot → render it (Custom Elements) → on user event POST to Node-RED → get
the new snapshot → re-render. No client-side reconciler is required because the server
computes snapshots.

The chosen component library base is **Shoelace 2.x (MIT)**. Its successor "Web Awesome"
is freemium; staying on the MIT base keeps the project unencumbered.

### 4. SSR is deferred, not precluded

Because the snapshot is rendering-agnostic, a later server-side or hybrid (SSR +
hydration) adapter is purely additive and does not disturb the Web Component default.
SSR is out of scope until a public, search-indexed surface is actually required.

### 5. Escape hatch for framework-specific components — opt-in, later

If a framework-specific capability with no semantic equivalent is ever needed, it is
exposed through a deliberately non-portable `ui-custom` node that names a framework
component and props directly. This is an explicit, clearly-marked opt-out of portability,
not the default, and is not built until a concrete need arises.

## Consequences

- **`nodes/webapp.js` must stop rendering on its own** and instead consume the
  `RenderSnapshot` from `packages/renderer`. Until the two renderers are unified, every
  adapter would have to be built twice. This is the first implementation step (see
  roadmap P21).
- The verbose `webapp-slot` / `webapp-item` preview HTML disappears as a side effect of
  consuming the snapshot through a real adapter.
- ADR 0001's "React in the renderer" decision is **superseded**. The renderer remains a
  framework-agnostic snapshot producer; React is no longer a planned dependency. A future
  React/MUI adapter, if built, is one adapter among several and lives below the snapshot
  seam.
- Component prop schemas must be audited to ensure they stay semantic; any framework token
  leaking into a schema is a defect.
- Any change to the snapshot/tokens contracts, the "theme injects no nodes" rule, or the
  Web Components default after this ADR requires a new ADR and is a stop condition.
