# ui-select

A dropdown for choosing one — or several — values from a static or
store-driven option list.

> Deutsch: [de/nodes/ui-select.md](../de/nodes/ui-select.md)

## Purpose

`ui-select` renders a dropdown / combobox. Its options come either from
validated static JSON or reactively from a store, and its selection is bound to
client state in both directions: **Value** reads, **Write To** writes.

## When to use

- Pick one value from a known list (status, country, category).
- Pick several values at once (**Multiple**).
- Options that change at runtime — bind **Options** to a store slice your flow
  fills.
- For 2–5 mutually exclusive choices that should all be visible, prefer
  [`ui-radio`](ui-radio.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Select N` |
| **Parent Slot** (`mount`) | Where the dropdown is placed. Required. | mount picker | — |
| **Label** (`label`) | The caption above the dropdown. Required, bindable. | binding / literal text | — |
| **Value** (`value`) | The **read** half: the currently selected value. With **Multiple** it is an array. Bindable with every binding kind. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): `store`, `flow` or `global` only. | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | A select has **no submit gesture**, so it always writes on `change` — `submit` and `change` behave identically here. Only `none` is different: it switches the automatic write-back off entirely. | `submit` / `change` / `none` | `submit` |
| **Options** (`options`) | One field, two types. **json** uses Node-RED's JSON editor and is validated before deploy (the node turns red on error) — exactly one of: object `{"<label>": "<value>"}`, string array `["A","B"]` (value = label), or object array `[{"label":…,"value":…}]`. **store** reads the options reactively from a store path. Empty renders a dropdown without options. | `json` / `store` | empty |
| **Placeholder** (`placeholder`) | Hint shown while nothing is selected. Bindable. | binding / literal text | empty |
| **Multiple** (`multiple`) | Allow multi-selection. With `true`, `value` is an array of the chosen values. | checkbox | `false` |
| **Size** (`size`) | Control size. | `(default)` / `sm` / `md` / `lg` | empty |
| **Disabled** (`disabled`) | Bindable condition that locks the dropdown. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition gating whether the dropdown renders. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-select` has **no `variant` field** — it inherits the app's theme tokens.

### Value / Write To / Write Trigger

The shared input-family model ([Forms](../guides/forms.md)): bind **Value** and
**Write To** to the same store sub-path for true two-way binding. Because there
is no submit gesture, the trigger setting only decides *whether* (not *when*)
the write-back happens: `none` = off, anything else = on `change`.

## Inputs

`ui-select` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null) | Sets the selected value and pushes a fresh snapshot. With **Multiple**, the payload must be an array. |
| `msg.ui.patch` | Overwrites definition fields (`options`, `placeholder`, `disabled`, …). Binding-backed fields (`value`, `options`) as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-select` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | the user changes the selection | `value` — the new value (an array with **Multiple**) |

Carries `appId`, `clientId`, `event` and `sourceId` on `msg.ui`. There is no
`submit` event.

## Examples

### 1. A status dropdown with static options and a live echo

A `filter` store, a `ui-select` with three static options whose Value and Write
To point at `filter.status`, and a `ui-text` echoing the selection.

Flow file: [`examples/guide/ui-select.json`](../../../examples/guide/ui-select.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-select.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideSelect/` and change the value.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [Bindings & State](../guides/bindings-state.md) — store-driven option lists
- [`ui-store`](ui-store.md) — options source and Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-select.md`
