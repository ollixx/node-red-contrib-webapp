# ui-route

A sub-page of the app — a URL route with its own layout, optional parameters
and an authz guard.

> Deutsch: [de/nodes/ui-route.md](../de/nodes/ui-route.md)

## Purpose

`ui-route` defines a **sub-page** of an app: a URL route with its own layout.
Paths can carry parameters (`/customers/:id`) that become `routeParam` bindings
for the mounted view nodes. The home page `/` is **not** a `ui-route` — it is
the implicit root route of the [`ui-app`](ui-app.md); a route path of `/` is
forbidden.

## When to use

- Add any page beyond the home page (`/customers`, `/customers/:id`, …).
- Capture URL parameters and read them via `routeParam` bindings.
- Load per-page data on `onEnter`; clean up on `onLeave`.
- Protect a page by group with **Groups** (`requiresGroup`).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and pickers; falls back to the `path` if empty. | free text | `Route N` |
| **App** | The parent `ui-app`, chosen from the app picker. Required. | app reference | — |
| **Pfad** (`path`) | The URL segment (`/<root>/<path>`), parameters via `:name`. Unique within the app; must not be empty and must not be `/` (reserved for the root route). Required. | url path | — |
| **Titel** (`title`) | A readable route title (for nav/breadcrumb). Fully bindable. A **literal** value shows in the browser tab; a dynamic binding is not resolved at render time (the tab falls back to the route id). | any binding | empty |
| **Parent Layout** (`layout`) | Layout preset for the route; sets the slots and the child-placement fields. | `vertical` / `horizontal` / `app` / `grid` / `absolute` | `vertical` |
| **Gruppen** (`requiresGroup`) | Comma-separated group names — a declarative authz guard. Empty means only authentication is required; set means the user needs **at least one** of the groups (server-enforced: direct URL access returns 403). | group names | empty |
| **Events** | Which lifecycle events emit — each ticked event adds an output port. | `onEnter` / `onLeave` | none |

## Inputs

`ui-route` is driven by the runtime — you normally wire nothing to it. Internally
it receives navigation to this route and component-state messages for its
children. **Addressing precedence:** a navigate message that already carries an
explicit target (`msg.ui.action.to`, from mode `route`/`url`) is passed through
unchanged — only a target-less `wire` navigate makes the route build the location
from its own `path`. Unknown/foreign messages pass through unchanged.

## Outputs / Events

One output port per ticked event:

| Event | Fires when | Key `msg.ui` fields |
|---|---|---|
| `onEnter` | the route is entered (deep-link, refresh or in-app navigate) | `event`, `route`, `params`, `clientId` |
| `onLeave` | the route is left | `event`, `route`, `params`, `clientId` |

`params` holds the resolved route parameters (e.g. `{ id: "42" }` for
`/customers/:id`). Lifecycle events fire on **every** arrival (the client always
navigates by full reload; the server fires the lifecycle on connect).

## Examples

### 1. A second page reachable by navigation

An app with a home page and one `ui-route` (`/details`); a `navigate` action on
the home page opens the route, whose content slot shows a line of text.

Flow file: [`examples/guide/ui-route.json`](../../../examples/guide/ui-route.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-route.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideRoute/` and click
   **Go to details** — the URL becomes `/webapp/guideRoute/details` and the
   detail page renders.

## Related

- [`ui-app`](ui-app.md) — the parent and the implicit root route
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — routes and navigate modes
- [`ui-action`](ui-action.md) — triggering navigation
- Contract doc (internal, German): `docs/nodes/structure/ui-route.md`
