# ui-container

A nestable layout container with its own child layout, variant chrome, and show/hide events.

> Deutsch: [de/nodes/ui-container.md](../de/nodes/ui-container.md)

## Purpose

`ui-container` is a **layout container** inside a route, dialog, or another
container. It mounts into a slot of its parent and provides its own child layout
(a layout preset) into which further view nodes mount — so you build arbitrarily
nested UI structure without lengthening slot paths. Its `variant` gives the
surface its chrome (card, panel, section, transparent, span), and it is the only
structural level below route/dialog that can emit **visibility events**
(`onShow` / `onHide`).

## When to use

- Group several nodes into a card/panel/section with its own internal layout.
- Compose an inline text line from several `ui-text` nodes (`variant = span`).
- Lazy-load a block's data on first display (`onShow` → `ui-query`) or clean up
  on hide (`onHide`).
- Toggle a block's visibility from a button (`msg.ui.component.op: hide/show`).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Container N` |
| **Parent Slot** (`mount`) | The slot this container mounts into. Required. Drives which placement fields show. | mount path | — |
| **Child Layout** (`layout`) | The preset arranging this container's direct children. Required. Determines the child slots and their placement fields. | `vertical`, `horizontal`, `app`, `grid`, `absolute` | `vertical` |
| **Variant** (`variant`) | Semantic surface role → the rendered chrome. | `card` (`<sl-card>`: border, padding, elevation), `panel` (1px border, no elevation), `section` (spacing only), `transparent` (no chrome), `span` (inline flow) | `card` |
| **Events** (`events`) | Enables `onShow` / `onHide` output ports. | checkboxes → ports | none |
| **Visible / Color** | Base fields (bindable): render gate, colour override. | binding / value | shown / theme |
| **Order / Row / Col / spans / X·Y** | Placement of the container in the parent slot (which show depends on the parent's layout). | numbers | canvas-y |

`Disabled` and `Size` are N/A (a container is not a control and has no size steps).

## Inputs

`ui-container` **has an input port**. It accepts:

- **`msg.ui.component.op`** (`show` / `hide`) — shows/hides the container and all
  its children, firing `onShow` / `onHide` if enabled.
- **`msg.ui.patch`** — overrides fields (e.g. `variant`).
- Unrecognised / foreign messages **pass through unchanged**.

It accepts **no** `msg.payload` primary value — a container has no displayable
value of its own.

## Outputs / Events

One output port per enabled event:

| Event | When | `msg.ui` fields |
|---|---|---|
| `onShow` | becomes visible (after `show` or initial render) | `event`, `sourceId`, `appId`, `clientId` |
| `onHide` | hidden (after `hide`) | `event`, `sourceId`, `appId`, `clientId` |

## Examples

### 1. A card container with children and onShow

A `card` container holding a heading and body; `onShow` is enabled and wired to a
debug node, which logs once the container first renders.

Flow file: [`examples/guide/ui-container.json`](../../../examples/guide/ui-container.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-container.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideContainer/` — the card shows the
   heading and body; the `onShow` payload appears in the debug sidebar.

## Related

- [Layout & Slots](../guides/layout-slots.md) — mount paths, layout presets
- [Theming & Components](../guides/theming-components.md) — variants and chrome
- [Actions & Events](../guides/actions-events.md) — wiring `onShow`/`onHide`
- Contract doc (internal, German): `docs/nodes/display/ui-container.md`
