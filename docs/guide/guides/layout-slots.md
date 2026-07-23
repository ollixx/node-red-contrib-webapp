# Layout & Slots

How the UI hierarchy is built: mount paths, layout presets, and the
placement fields each preset gives its children.

> Deutsch: [../de/guides/layout-slots.md](../de/guides/layout-slots.md)

## Goal

Understand where a component "lives" (its mount), which layout presets
exist, and how children are positioned inside each preset — and build a page
with a header, a grid area, and a horizontal row.

## Prerequisites

- The package is installed and you have built a first app —
  [Getting started](../getting-started.md).

## The structure rule

The UI hierarchy comes **exclusively** from node configuration:

- Every view node declares its **parent slot** in the `mount` field (the
  editor's mount picker shows a tree of all available slots).
- Every node also declares its **app** (`app` field).
- **Wires never express hierarchy** — they carry data and events only.

A mount path addresses `<target>/<slot>`. In the editor you simply pick the
slot from the tree; in an exported flow you will see forms like:

| Mount string | Meaning |
|---|---|
| `myApp.content` | the `content` slot of the app (named mount: node id + slot) |
| `myContainer.content` | the `content` slot of a `ui-container` |
| `myDialog.footer` | the `footer` slot of a `ui-dialog` |
| `route:/customers/content` | the `content` slot of the route with path `/customers` |
| `dialog:myDialog/content` | explicit dialog scope (same target as `myDialog.content`) |

Every mounted node occupies exactly one slot region; an unresolvable mount
(unknown target or slot) is rejected at deploy time.

## Layout presets

There are no custom layout nodes — layout is always one of the shared
**presets**, chosen in the `layout` field of the structural nodes (`ui-app`,
`ui-route`, `ui-dialog`, `ui-container`):

| Preset | Slots | Arrangement |
|---|---|---|
| `vertical` | `content` | children stacked top-to-bottom |
| `horizontal` | `content` | children side by side |
| `grid` | `content` | children placed in rows/columns |
| `absolute` | `content` | children at free X/Y coordinates |
| `app` | `header`, `navbar`, `content`, `footer` | application shell |
| `dialog` | `header`, `header-actions`, `content`, `footer` | dialog shell |

## Placement fields

The chosen preset of the **parent slot** determines which placement fields
its direct children get (they appear automatically in the child's editor):

| Parent preset | Child fields | Meaning |
|---|---|---|
| `vertical` / `horizontal` | `order` | sort key within the stack/row |
| `grid` | `row`, `col`, `colSize`, `rowSize` | 1-based cell position and span (positive integers) |
| `absolute` | `X`, `Y` | free coordinates (0 and negative allowed) |
| `app` | — | children fill their slot |

**Order default:** if you leave `order` empty, the node's vertical position
on the Node-RED canvas is used as its sort key — arrange the nodes on the
canvas top-to-bottom and the page follows. An explicitly set `order` always
wins over canvas position.

## Steps

1. Create a `ui-app` with the `app` layout. Mount a `ui-text` (variant
   `heading-2`) into its **header** slot. You see: a page with a title bar
   area at the top.
2. Add a `ui-container` with layout `grid`, mounted into the app's
   **content** slot. Mount three `ui-text` nodes into the container's
   `content` slot with placements (row 1 / col 1), (row 1 / col 2), and
   (row 2 / col 1 with `colSize` 2). You see: two cells side by side and a
   third spanning the full width below them.
3. Add a second `ui-container` with layout `horizontal` in the app's
   content, and mount two `ui-text` nodes with `order` 1 and 2. You see:
   two texts side by side, in the configured order.
4. Deploy and open the app — the whole page structure came from `mount` +
   `layout`, without a single wire.

## Example flow

The finished result of the steps:
[`examples/guide/layout-slots.json`](../../../examples/guide/layout-slots.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/layout-slots.json` (or paste its JSON) →
   **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/layoutApp/` — header, grid area
   and horizontal row as described.

## Where next

- [Navigation & Dialogs](navigation-dialogs.md) — routes and dialogs as
  additional mount targets.
- [Displaying data](displaying-data.md) — repeating structure per data item.
- Node reference: see the node list in the [guide home](../README.md#contents).
