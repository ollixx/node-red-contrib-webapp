# ui-radio

A radio-button group: exactly one option out of a small, always-visible set.

> Deutsch: [de/nodes/ui-radio.md](../de/nodes/ui-radio.md)

## Purpose

`ui-radio` renders a group of radio buttons. Exactly one option is selected at
a time, and the selection is bound to client state in both directions:
**Value** reads, **Write To** writes. It shares its option model with
[`ui-select`](ui-select.md).

## When to use

- 2–5 mutually exclusive choices that should all be visible at once
  (role, delivery method, payment type).
- When comparing the options matters more than saving space.
- For long lists or multi-selection use [`ui-select`](ui-select.md); for
  independent on/off flags use [`ui-checkbox`](ui-checkbox.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Radio N` |
| **Parent Slot** (`mount`) | Where the group is placed. Required. | mount picker | — |
| **Label** (`label`) | The group caption. Required, bindable (same set as [`ui-select`](ui-select.md)). | binding / literal text | — |
| **Value** (`value`) | The **read** half: the value of the currently selected option. Bindable with every binding kind. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): `store`, `flow` or `global` only. | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | A radio group has **no submit gesture** — it always writes on `change`. Only `none` differs: it switches the automatic write-back off. | `submit` / `change` / `none` | `submit` |
| **Options** (`options`) | One field, two types — the **same helper as [`ui-select`](ui-select.md)**. **json** validates exactly one of: object `{"<label>": "<value>"}`, string array `["A","B"]`, or object array `[{"label":…,"value":…}]` (the node turns red on a bad structure). **store** reads the options reactively from a store path. Optional: an unconfigured group stays valid. | `json` / `store` | empty |
| **Orientation** (`orientation`) | Layout of the buttons. `vertical` = stacked; `horizontal` = side by side. | `vertical` / `horizontal` | `vertical` |
| **Disabled** (`disabled`) | Bindable condition that locks the whole group. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition gating whether the group renders. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-radio` has **no `variant`** and **no size steps** (the editor shows the
Size row under "Advanced" with an N/A hint). Unlike [`ui-select`](ui-select.md) it has no
**Placeholder**.

### Value / Write To / Write Trigger

The shared input-family model ([Forms](../guides/forms.md)): bind **Value** and
**Write To** to the same store sub-path for true two-way binding. Without a
submit gesture the trigger only decides *whether* the write-back happens.

## Inputs

`ui-radio` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null) | Sets the pre-selected option's value and pushes a fresh snapshot. |
| `msg.ui.patch` | Overwrites definition fields (`options`, `orientation`, `disabled`, …). Binding-backed fields (`value`, `options`) as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-radio` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | the user picks another option | `value` — the newly selected option's value |

Carries `appId`, `clientId`, `event` and `sourceId` on `msg.ui`. There is no
`submit` event.

## Examples

### 1. A horizontal role picker bound to a store

A `form` store, a `ui-radio` with three static options laid out horizontally
whose Value and Write To point at `form.role`, and a `ui-text` echoing the
choice.

Flow file: [`examples/guide/ui-radio.json`](../../../examples/guide/ui-radio.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-radio.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideRadio/` and pick an option.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [`ui-select`](ui-select.md) — same option model, for long lists / multi-select
- [`ui-store`](ui-store.md) — options source and Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-radio.md`
