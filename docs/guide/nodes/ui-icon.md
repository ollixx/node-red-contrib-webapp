# ui-icon

Renders an icon by symbolic name — icon-set agnostic, bindable name and colour.

> Deutsch: [de/nodes/ui-icon.md](../de/nodes/ui-icon.md)

## Purpose

`ui-icon` renders an **icon by symbolic name**, independent of the icon set. The
renderer backend decides which set is used (Shoelace system icons, the vendored
Bootstrap set, an extra registered library); the node only knows the semantic
name. Both the **name** and the **colour** are bindable, so an icon can change
live from state/store/query. It is purely presentational and emits no events.

## When to use

- Show a status/decorative icon next to text or in a button/list row.
- Swap the icon live based on data (a `state`/`store`-bound name).
- Tint the icon to a theme token so it follows the app theme.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Icon N` |
| **Parent Slot** (`mount`) | The slot this icon mounts into. Required. | mount path | — |
| **Icon Name** (`icon`) | The backend-neutral icon value. Required, bindable (P239). Two ways in one control. | **Icon** (literal): a bare name (`home`) uses the default library; `library:name` (`lucide:user`) picks a registered library; the picker + preview are literal-only. **Binding**: any canonical kind (store/query/routeParam/reactive/msg/flow/global/env) — a bound name swaps the icon live. | — |
| **Color** (`color`) | The icon colour — the shared standard control (ADR 0039). Three ways. | **Theme Token** (`primary`, `success`, `warning`, `danger`, `neutral`, `info`, `muted`) → persisted `token:<name>`, rendered `var(--wa-color-<token>)`, follows the app theme; **Colour** (any CSS value via the selector or typed); **Binding** (any canonical kind — a bound colour tints live). | empty (inherits text colour) |
| **Size** (`size`) | Icon size token. | `xs`, `sm`, `md`, `lg`, `xl` (legacy free CSS values round-trip) | `md` |
| **Visible** (`visible`) | Render gate (bindable). | binding | shown |
| **Order / Row / Col / spans / X·Y** | Placement in the parent slot. | numbers | canvas-y |

`Disabled` is N/A (an icon has no interactive state).

### The colour model (ADR 0039)

`ui-icon` has no `variant` field — colour is the base `color` field, which is the
**superset**: it offers the theme tokens **and** any colour (`variant` is the
reduction to just the tokens). A **theme token** (`token:primary`) renders as
`var(--wa-color-primary)` and follows the app's `designTokens`, so it re-themes
with the app; a free colour (`#ff0000`) is fixed. An unknown value is ignored (no
invalid CSS is ever emitted). Empty ⇒ the icon inherits the surrounding text
colour.

## Inputs

`ui-icon` **has an input port**:

- **`msg.ui.component.op`** (`show` / `hide`) — shows/hides the icon.
- **`msg.ui.patch`** — overrides fields (`icon`, `size`, `color`).
- Unrecognised / foreign messages **pass through unchanged**.

It has **no** `msg.payload` primary value.

## Outputs / Events

None — `ui-icon` has no output port and emits no events.

## Examples

### 1. A token-coloured icon

An icon (`home`) tinted with the `primary` theme token at size `lg`.

Flow file: [`examples/guide/ui-icon.json`](../../../examples/guide/ui-icon.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-icon.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideIcon/` — the icon renders in the
   theme's primary colour.

## Related

- [Theming & Components](../guides/theming-components.md) — design tokens, variants vs. colours
- [`ui-image`](ui-image.md) — a raster image (not a vector icon)
- Contract doc (internal, German): `docs/nodes/display/ui-icon.md`
