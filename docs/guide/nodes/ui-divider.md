# ui-divider

A visual divider line between content areas — horizontal or vertical, with an
optional centred label.

> Deutsch: [de/nodes/ui-divider.md](../de/nodes/ui-divider.md)

## Purpose

`ui-divider` renders a separator line between neighbouring content areas. It is
purely presentational: it holds no state, emits no events, and has no ports.
Use it to visually structure a page — between form sections, list groups, or
side-by-side panels — optionally with a small centred label such as "Or".

## When to use

- Separate stacked content in a vertical layout (**horizontal** divider).
- Separate side-by-side areas in a horizontal layout (**vertical** divider).
- Label an alternative ("Or", "Section B") with the centred **Label**.
- Do NOT use it to group interactive content with a heading — a
  `ui-container` with a title is the better fit there.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and pickers. | free text | `Divider N` (auto-numbered) |
| **Parent Slot** (`mount`) | Where the divider lives — the parent slot picked via the mount tree (`ui-app`, `ui-route`, `ui-dialog` or `ui-container`). Required. | slot path | — |
| **Orientation** | Direction of the line. `horizontal` separates stacked content; `vertical` separates side-by-side content (only visible inside a horizontal/grid arrangement). | `horizontal` / `vertical` | `horizontal` |
| **Label** | Optional text shown centred on the line. Fully bindable — a fixed text (literal) or a live value from a store, state, query, route param, … | any text / binding | empty (no label) |
| **Visible** | Render gate: when the bound value is `false`, the divider is not rendered at all. | boolean / binding | visible |
| **Color** | Colour of the line. Bindable; leave empty to inherit the app theme's border colour. | CSS colour / binding | theme default |
| **Disabled** | Not applicable — a divider has no interactive state (shown disabled with a hint). | — | — |
| **Size** | Not applicable — a divider has no size steps (shown disabled, under "Advanced"). | — | — |
| **Placement** (`order` / `row`·`col` / `colSize`·`rowSize` / `X`·`Y`) | Position within the parent's layout; which fields appear depends on the parent's layout preset (order for stacks, row/col for grids, X/Y for absolute). | numbers | canvas order |

## Inputs

`ui-divider` has **no input port** and receives no messages. It is driven
entirely by its configuration; the bindable fields (Label, Color, Visible)
update live through their bindings — bind them to a store to change the
divider at runtime.

## Outputs / Events

None — the divider emits no events.

## Examples

### 1. Two sections separated by a labelled divider

Two text blocks stacked vertically, separated by a horizontal divider with the
centred label "Or" and a custom line colour.

Flow file: [`examples/guide/ui-divider.json`](../../../examples/guide/ui-divider.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/ui-divider.json` (or paste its JSON
   content) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideDivider/` — you see
   "Section A", a purple divider labelled "Or", and "Section B".

## Related

- [User guide home](../README.md)
- Contract doc (internal, German): `docs/nodes/display/ui-divider.md`
