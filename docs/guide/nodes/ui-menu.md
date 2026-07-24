# ui-menu

A navigation menu that exposes the app's routes to the user.

> Deutsch: [de/nodes/ui-menu.md](../de/nodes/ui-menu.md)

## Purpose

`ui-menu` renders a **navigation menu** — a list of entries the user clicks to
move around the app. The entries come from a bindable `items` source (a static
array or a store/state binding); the currently active route can be highlighted
from a second binding. Clicking a navigable entry emits a `navigate` event on
the output port, which you wire to a [`ui-action`](ui-action.md) to actually
change route.

## When to use

- Build the primary navigation for an app — typically in a `navbar` or `header`
  slot of an `app`-layout parent.
- Drive the menu from data (a store binding) so entries change with app state.
- For a positional trail showing *where* the user is, use
  [`ui-breadcrumb`](ui-breadcrumb.md) instead.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Menu N` |
| **Parent Slot** (`mount`) | The slot this menu mounts into. Required. | mount path | — |
| **Display Type** (`displayType`) | Names the intended spatial layout. **Honest note:** today both values render an identical bare menu — the sidebar/topbar spatial modes are *planned* but not yet implemented; the renderer does not branch on this field. | `sidebar`, `topbar` | `sidebar` |
| **Items** (`items`) | The menu entries — a static array or a binding. Each item: `{ "label": …, "route"?: …, "href"?: …, "path"?: …, "icon"?: …, "children"?: [...] }` (one of `route`/`href`/`path`). The menu renders its own entries (no slot per item). Required. | `literal`/`json` (static array), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | — |
| **Active Route** (`activeRoute`) | Read-only binding on the path/route of the active item; the matching entry is highlighted. Typically bound to a store value set on route `onEnter`. | same kinds as Items | — |
| **Visible** (`visible`) | Base field — declarative visibility (bindable boolean). | boolean binding | shown |
| **Disabled** / **Color** | Base fields. | — | — |

`Size` is N/A (this node has no size steps). A legacy `dropdown` display type was
removed (no trigger model); a deployed legacy `dropdown` value falls back to
`sidebar`.

## Inputs

`ui-menu` **has an input port**, but does **not** consume `msg.payload` or
`msg.ui.patch` today — both **pass through unchanged** (an items-replace or
field-patch by message is not wired yet).

- **Interaction verbs** (`msg.ui.action.type`): `show`, `hide`, `select` —
  dispatched from a wired `ui-action`.
- **`msg.ui.component.op`** (`show`, `hide`, …) — toggles the whole menu's
  visibility.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

`ui-menu` has an output port. It emits when the user clicks an item with a
route/path:

| Event | When | `msg.ui` fields |
|---|---|---|
| `navigate` | user clicks a navigable item | `event: "navigate"`, `params.path`, `clientId`, `sourceId`, `appId` |

Items with `href` (external links) do **not** emit `navigate` — the browser
opens the link directly. Wire `navigate` → `ui-action` (`navigate`,
`to: msg.ui.params.path`) to change route.

## Examples

### 1. A sidebar menu with an active entry

A three-item menu (Home, Customers, Settings) with the active route highlighted
from a store value.

Flow file: [`examples/guide/ui-menu.json`](../../../examples/guide/ui-menu.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-menu.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideMenu/` — a menu with three
   entries appears, "Customers" highlighted as active.

## Related

- [`ui-breadcrumb`](ui-breadcrumb.md) — a positional path trail
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — routes and the navigate modes
- [`ui-action`](ui-action.md) — turns a `navigate` event into a route change
- [Bindings & State](../guides/bindings-state.md) — the binding kinds, stores
- Contract doc (internal, German): `docs/nodes/navigation/ui-menu.md`
