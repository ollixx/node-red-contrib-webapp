# ui-datepicker

A date, date-and-time or time field whose value is an ISO-8601 string.

> Deutsch: [de/nodes/ui-datepicker.md](../de/nodes/ui-datepicker.md)

## Purpose

`ui-datepicker` renders a date/time entry field and binds it to client state in
both directions: **Value Path** reads, **Write To** writes. The value is always
an ISO-8601 string whose exact shape follows the chosen **Mode**.

## When to use

- A start date, a due date, an appointment time, a birthday.
- A date range — use two datepickers and set the second one's **Min** from the
  first one's `change` event.
- For a free-text date use [`ui-input`](ui-input.md); you then own the parsing.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Datepicker N` |
| **Parent Slot** (`mount`) | Where the field is placed. Required. | mount picker | — |
| **Label** (`label`) | The caption above the field. Required, bindable. | binding / literal text | — |
| **Value Path** (`value`) | The **read** half: the date as an ISO-8601 string — `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` or `HH:mm` depending on **Mode**. Bindable with every binding kind. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): `store`, `flow` or `global` only. | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | The datepicker renders a **text-like** input and therefore honours the trigger: `submit` writes on Enter/blur, `change` on every pick, `none` disables the write-back. | `submit` / `change` / `none` | `submit` |
| **Mode** (`mode`) | What is entered. `date` = date only; `datetime` = date and time; `time` = time only. | `date` / `datetime` / `time` | `date` |
| **Min** (`min`) | Earliest allowed date — earlier days are disabled in the calendar. | text `YYYY-MM-DD` | empty |
| **Max** (`max`) | Latest allowed date — later days are disabled in the calendar. | text `YYYY-MM-DD` | empty |
| **Placeholder** (`placeholder`) | Hint shown while nothing is picked. Bindable. | binding / literal text | empty |
| **Disabled** (`disabled`) | Bindable condition that locks the field. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition gating whether the field renders. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-datepicker` has **no `variant`** and **no size steps** (the Size row appears
under "Advanced" with an N/A hint).

### Value / Write To / Write Trigger

The shared input-family model ([Forms](../guides/forms.md)): bind **Value Path**
and **Write To** to the same store sub-path for true two-way binding. Unlike
the checkbox/switch/select/radio family this control *is* text-like, so the
trigger really does decide **when** the write happens.

## Inputs

`ui-datepicker` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null, ISO-8601 string) | Sets the value and pushes a fresh snapshot. |
| `msg.ui.patch` | Overwrites definition fields (`min`, `max`, `mode`, `disabled`, …). Binding-backed fields (`value`) as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `reset`. |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-datepicker` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | the user picks a date / time | `value` — the new ISO-8601 string (shape per **Mode**) |

Carries `appId`, `clientId`, `event` and `sourceId` on `msg.ui`.

## Examples

### 1. A bounded start-date field with a live echo

A `booking` store, a `ui-datepicker` in `date` mode with **Min**/**Max** whose
Value Path and Write To point at `booking.start`, and a `ui-text` reading the
same slice.

Flow file: [`examples/guide/ui-datepicker.json`](../../../examples/guide/ui-datepicker.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-datepicker.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideDatepicker/` and pick a date.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [`ui-input`](ui-input.md) — free-text alternative
- [`ui-store`](ui-store.md) — the usual Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-datepicker.md`
