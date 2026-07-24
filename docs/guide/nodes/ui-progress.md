# ui-progress

A progress bar, spinner or ring for loading and progress states.

> Deutsch: [de/nodes/ui-progress.md](../de/nodes/ui-progress.md)

## Purpose

`ui-progress` shows a **progress bar or loading indicator**. The `displayType`
chooses a bar, spinner or ring. The value comes from a binding (state, query,
store or the incoming message). When the value is missing the node shows an
**indeterminate** (endlessly animated) state — not zero.

## When to use

- Show determinate progress of a known task (upload 65 %, import 3/10).
- Show an indeterminate busy state while waiting (leave `value` unset).
- For skeleton placeholders that mimic the shape of loading content, use
  [`ui-skeleton`](ui-skeleton.md) instead.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Progress N` |
| **Parent Slot** (`mount`) | The slot this mounts into. Required. | mount path | — |
| **Display Type** (`displayType`) | The rendering form (a display type, not a semantic variant). | `bar` (horizontal bar), `spinner` (always indeterminate), `circular` (ring; a spinner when it has no value) | `bar` |
| **Value** (`value`) | The progress value `0…max` (bindable). Missing/`null` → indeterminate. | `literal` (num), `state`, `store`, `query`, `routeParam`, `msg`, `flow`, `global`, `jsonata`, `env` | empty |
| **Label** (`label`) | Caption next to/above the progress; also the a11y label (bindable). | canonical value binding | empty |
| **Max** (`max`) | Upper bound of the range; the fill scales `value / max`. | number | `100` |
| **Show Value** (`showValue`) | Overlay the current percentage (relative to `max`). Ignored for indeterminate/spinner. | checkbox | off |
| **Visible** (`visible`) | Base field — declarative visibility (bindable boolean). | boolean binding | shown |
| **Color** (`color`) | Base field — the indicator fill colour (bindable). Empty → theme `colorPrimary`. | value binding | theme |

`Disabled` and `Size` are N/A (a progress bar has no interactive state and no
size steps). There is no `variant`/`severity` — `displayType` is a rendering
form, not a colour role.

## Inputs

`ui-progress` **has an input port** for push updates:

- **`msg.payload`** updates `value` and pushes a fresh snapshot; other fields
  stay unchanged.
- **`msg.ui.patch`** — overrides fields (`value`, `displayType`, `label`,
  `showValue`, `max`).
- **`msg.ui.component.op`** (`show`, `hide`, …) — controls visibility.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

None — `ui-progress` has no output port and emits no events.

## Examples

### 1. A determinate progress bar

A bar at 65 % of 100 with a label and the percentage shown; a heading sits above
so the app root is never empty.

Flow file: [`examples/guide/ui-progress.json`](../../../examples/guide/ui-progress.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-progress.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideProgress/` — a filled bar shows
   "65%".

## Related

- [`ui-skeleton`](ui-skeleton.md) — placeholder shapes for loading content
- [Bindings & State](../guides/bindings-state.md) — the binding kinds, stores
- Contract doc (internal, German): `docs/nodes/feedback/ui-progress.md`
