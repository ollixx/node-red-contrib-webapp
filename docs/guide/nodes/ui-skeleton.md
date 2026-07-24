# ui-skeleton

An animated loading placeholder that mimics the shape of the real content.

> Deutsch: [de/nodes/ui-skeleton.md](../de/nodes/ui-skeleton.md)

## Purpose

`ui-skeleton` renders an **animated loading placeholder** that imitates the
shape of the content still to come. It is shown while `visible` is truthy —
typically while a query loads — and hidden once the data is ready, at which
point the real components take over. The `displayType` chooses the placeholder's
outline: text lines, an avatar, a card or a table.

## When to use

- Fill a slot with a placeholder while a `ui-query` loads, sharing the slot with
  the real components (their visibility is complementary to the skeleton's).
- Give the page a stable shape during loading instead of a blank flash.
- For a determinate/indeterminate progress indicator rather than a shape
  placeholder, use [`ui-progress`](ui-progress.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Skeleton N` |
| **Parent Slot** (`mount`) | The slot this mounts into. Required. | mount path | — |
| **Display Type** (`displayType`) | The placeholder shape (a display type, not a semantic variant). | `text` → `lines` stacked placeholder lines; `avatar` → a **round** placeholder; `card` → a block (media + lines in a bordered box); `table` → **`lines` rows × 3 columns** | `text` |
| **Lines** (`lines`) | Number of simulated lines. Applies to `text` (line count) **and** `table` (row count, 3 columns each); ignored for `avatar`/`card`. Must be an integer ≥ 1. | number ≥ 1 | `3` |
| **Visible** (`visible`) | Base field — the load-state gate (bindable boolean). Truthy = skeleton shown; falsy = hidden. Empty = always visible. Typically a `query`/`store` "isLoading" value. | boolean binding | shown |
| **Color** (`color`) | Base field — tints the placeholder/shimmer fill (theme token, semantic token or CSS colour). Empty = neutral theme colour. | value binding | neutral |

`Disabled` and `Size` are N/A (a loading placeholder is not interactive and has
no size steps). There is no `variant`/`severity` — `displayType` is a rendering
form.

## Inputs

`ui-skeleton` **has an input port** but a **narrow** one (conformance-measured,
P241):

- **`msg.ui.component.op`** (`show`, `hide`, `enable`, `disable`, …) — toggles
  visibility/interaction alongside the `visible` binding.
- Unrecognised / foreign messages **pass through unchanged**.
- **`msg.ui.patch` is currently NOT supported** — an incoming message does not
  override `displayType` or `lines`. (Whether it should is an open, cross-node
  owner decision; this documents today's behaviour.)

## Outputs / Events

None — `ui-skeleton` has no output port and emits no events.

## Examples

### 1. A text skeleton

A text skeleton of four placeholder lines standing in for loading content; a
heading sits above so the app root is never empty.

Flow file: [`examples/guide/ui-skeleton.json`](../../../examples/guide/ui-skeleton.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-skeleton.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideSkeleton/` — four shimmering
   placeholder lines appear.

## Related

- [`ui-progress`](ui-progress.md) — a determinate/indeterminate progress indicator
- [`ui-query`](../guides/displaying-data.md) — the typical "isLoading" data source
- [Bindings & State](../guides/bindings-state.md) — the boolean binding kinds
- Contract doc (internal, German): `docs/nodes/feedback/ui-skeleton.md`
