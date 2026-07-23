# ui-checkbox

A single on/off checkbox bound to a boolean in client state.

> Deutsch: [de/nodes/ui-checkbox.md](../de/nodes/ui-checkbox.md)

## Purpose

`ui-checkbox` renders one checkbox whose checked state is bound to client state
in both directions: **Value** reads the boolean, **Write To** persists the
user's toggle. Unlike [`ui-radio`](ui-radio.md) it is an *independent* flag —
use several of them for independent options.

## When to use

- A single boolean flag: "accept the terms", "send me the newsletter",
  "remember me".
- Several independent flags — one `ui-checkbox` per flag.
- For a switch-style control with on/off captions use [`ui-switch`](ui-switch.md); for
  "exactly one of N" use [`ui-radio`](ui-radio.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Checkbox N` |
| **Parent Slot** (`mount`) | Where the checkbox is placed. Required. | mount picker | — |
| **Label** (`label`) | The caption next to the box. Required, bindable. | binding / literal text | — |
| **Value Path** (`value`) | The **read** half: the checked state. Bindable with every binding kind — typically a `store` binding on a boolean sub-path. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): `store`, `flow` or `global` only. | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | A checkbox has **no submit gesture** — it always writes on `change`. Only `none` differs: it switches the automatic write-back off. | `submit` / `change` / `none` | `submit` |
| **Size** (`size`) | Checkbox size (its own row, not the shared Size select). | `Default` / `xs` / `sm` / `md` / `lg` / `xl` | `Default` |
| **Disabled** (`disabled`) | Bindable condition that locks the checkbox. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition gating whether the checkbox renders. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-checkbox` has **no `variant` field** — it inherits the app's theme tokens.

### Value / Write To / Write Trigger

The shared input-family model ([Forms](../guides/forms.md)): bind **Value Path**
and **Write To** to the same boolean store sub-path for true two-way binding.
Without a submit gesture the trigger only decides *whether* the write-back
happens.

## Inputs

`ui-checkbox` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null) | Sets the checked state (boolean) and pushes a fresh snapshot. |
| `msg.ui.patch` | Overwrites definition fields (`disabled`, …). Binding-backed fields (`value`) as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-checkbox` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | the user ticks or unticks the box | `checked` — the new boolean state |

Note the parameter name: a checkbox reports **`checked`**, not `value`. Carries
`appId`, `clientId`, `event` and `sourceId` on `msg.ui`. There is no `submit`
event.

## Examples

### 1. A terms checkbox with a live status line

A `prefs` store, a `ui-checkbox` whose Value Path and Write To point at
`prefs.accepted`, and a `ui-text` reading the same slice.

Flow file: [`examples/guide/ui-checkbox.json`](../../../examples/guide/ui-checkbox.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-checkbox.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideCheckbox/` and toggle the box.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [`ui-radio`](ui-radio.md) — exactly one of N
- [`ui-store`](ui-store.md) — the usual Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-checkbox.md`
