# ui-slider

A numeric slider with min/max/step and an optional value readout.

> Deutsch: [de/nodes/ui-slider.md](../de/nodes/ui-slider.md)

## Purpose

`ui-slider` renders a horizontal slider for a number and binds it to client
state in both directions: **Value** reads, **Write To** writes. Use it
where the *range* matters more than the exact digits.

## When to use

- Volume, brightness, a threshold, a percentage, a zoom level.
- Live preview: a slider bound to a store slice re-renders every view bound to
  the same slice while the user drags.
- For an exact number typed by hand use [`ui-input`](ui-input.md) with input
  type `number`.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Slider N` |
| **Parent Slot** (`mount`) | Where the slider is placed. Required. | mount picker | — |
| **Label** (`label`) | Caption for the slider. Optional — empty renders no label. Bindable. | binding / literal text | empty |
| **Value** (`value`) | The **read** half: the numeric value. Bindable with every binding kind. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): `store`, `flow` or `global` only. The value is handed over as a numeric string. | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | A slider has **no submit gesture** — it always writes on `change` (while dragging). Only `none` differs: it switches the automatic write-back off. | `submit` / `change` / `none` | `submit` |
| **Min** (`min`) | Lower end of the range. Empty leaves the backend default. | number | empty |
| **Max** (`max`) | Upper end of the range. Empty leaves the backend default. | number | empty |
| **Step** (`step`) | Increment the handle moves in. Must be positive. | number > 0 | empty |
| **Show Value** (`showValue`) | Show the current number next to the slider. | checkbox | `false` |
| **Disabled** (`disabled`) | Bindable condition that locks the slider. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition gating whether the slider renders. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-slider` has **no `variant`** and **no size steps** (the Size row appears
under "Advanced" with an N/A hint).

### Value / Write To / Write Trigger

The shared input-family model ([Forms](../guides/forms.md)): bind **Value**
and **Write To** to the same numeric store sub-path for true two-way binding.
Without a submit gesture the trigger only decides *whether* the write-back
happens — with `change`/`submit` it fires continuously while dragging.

## Inputs

`ui-slider` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null) | Sets the numeric value (clipped to the configured `min`/`max` range) and pushes a fresh snapshot. |
| `msg.ui.patch` | Overwrites definition fields (`min`, `max`, `step`, `disabled`, …). Binding-backed fields (`value`, `disabled`) as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-slider` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | the user moves the handle | `value` — the new numeric value |

Carries `appId`, `clientId`, `event` and `sourceId` on `msg.ui`. There is no
`submit` event.

## Examples

### 1. A volume slider with a live readout

A `settings` store, a `ui-slider` (0–100, step 5, **Show Value** on) whose Value
and Write To point at `settings.volume`, and a `ui-text` mirroring the
slice.

Flow file: [`examples/guide/ui-slider.json`](../../../examples/guide/ui-slider.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-slider.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideSlider/` and drag the handle.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [`ui-input`](ui-input.md) — typed numbers (input type `number`)
- [`ui-store`](ui-store.md) — the usual Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-slider.md`
