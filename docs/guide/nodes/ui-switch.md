# ui-switch

A toggle switch for a boolean, with optional on/off captions.

> Deutsch: [de/nodes/ui-switch.md](../de/nodes/ui-switch.md)

## Purpose

`ui-switch` renders a toggle switch whose state is bound to client state in both
directions: **Value Path** reads the boolean, **Write To** persists the toggle.
It is the "setting" flavour of a boolean control — [`ui-checkbox`](ui-checkbox.md)
is the "form field" flavour.

## When to use

- Settings that take effect immediately: notifications on/off, dark mode,
  a live-update toggle.
- Anywhere an on/off state should read as a switch rather than a tick box.
- For a form field with an agreement semantic use [`ui-checkbox`](ui-checkbox.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Switch N` |
| **Parent Slot** (`mount`) | Where the switch is placed. Required. | mount picker | — |
| **Value Path** (`value`) | The **read** half: the toggle state. Bindable with every binding kind — typically a `store` binding on a boolean sub-path. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): `store`, `flow` or `global` only. | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | A switch has **no submit gesture** — it always writes on `change`. Only `none` differs: it switches the automatic write-back off. | `submit` / `change` / `none` | `submit` |
| **Label** (`label`) | Caption next to the switch. Optional — empty renders no label. Bindable. | binding / literal text | empty |
| **Label On** (`labelOn`) | Text shown while the switch is on (e.g. "On"). Bindable. | binding / literal text | empty |
| **Label Off** (`labelOff`) | Text shown while the switch is off (e.g. "Off"). Bindable. | binding / literal text | empty |
| **Disabled** (`disabled`) | Bindable condition that locks the switch. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition gating whether the switch renders. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-switch` has **no `variant`** and **no size steps** (the Size row appears
under "Advanced" with an N/A hint).

### Value / Write To / Write Trigger

The shared input-family model ([Forms](../guides/forms.md)): bind **Value Path**
and **Write To** to the same boolean store sub-path for true two-way binding.
Without a submit gesture the trigger only decides *whether* the write-back
happens.

## Inputs

`ui-switch` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null) | Sets the toggle state (boolean) and pushes a fresh snapshot. |
| `msg.ui.patch` | Overwrites definition fields (`label`, `labelOn`, `labelOff`, `disabled`, …). Binding-backed fields (`value`) as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-switch` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | the user flips the switch | `checked` — the new boolean state |

Note the parameter name: a switch reports **`checked`**, not `value`. Carries
`appId`, `clientId`, `event` and `sourceId` on `msg.ui`. There is no `submit`
event.

## Examples

### 1. A notification switch with on/off captions

A `settings` store, a `ui-switch` with **Label On** / **Label Off** whose Value
Path and Write To point at `settings.notify`, and a `ui-text` reading the same
slice.

Flow file: [`examples/guide/ui-switch.json`](../../../examples/guide/ui-switch.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-switch.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideSwitch/` and flip the switch.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [`ui-checkbox`](ui-checkbox.md) — the form-field flavour of a boolean
- [`ui-store`](ui-store.md) — the usual Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-switch.md`
