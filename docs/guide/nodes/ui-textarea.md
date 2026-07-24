# ui-textarea

A multi-line text field with an optional character counter — the long-form
sibling of [`ui-input`](ui-input.md).

> Deutsch: [de/nodes/ui-textarea.md](../de/nodes/ui-textarea.md)

## Purpose

`ui-textarea` renders a multi-line entry field and binds it to client state in
both directions: **Value** reads, **Write To** writes. Its height is set with
**Lines**, and **Max Length** turns on a live character counter that also caps
the input.

## When to use

- Comments, notes, descriptions, addresses, message bodies.
- Any free text that does not fit on one line.
- For a single line use [`ui-input`](ui-input.md) instead — its `submit` gesture
  is Enter, which a textarea needs for line breaks.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Textarea N` |
| **Parent Slot** (`mount`) | Where the field is placed. Required. | mount picker | — |
| **Label** (`label`) | The caption above the field. Required. Bindable. | binding / literal text | — |
| **Value** (`value`) | The **read** half: the text shown. Bindable with every binding kind. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): `store`, `flow` or `global` only. Empty = no automatic write-back. | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | When the write happens. For a textarea `submit` means **blur** (leaving the field) — Enter inserts a line break. | `submit` / `change` / `none` | `submit` |
| **Placeholder** (`placeholder`) | Hint text shown while the field is empty. Bindable. | binding / literal text | empty |
| **Lines** (`lines`) | Number of visible text rows (the field height). Empty leaves the backend default. | integer ≥ 1 | empty |
| **Max Length** (`maxLength`) | Maximum number of characters. When set, a character counter appears and input beyond the limit is blocked. | integer ≥ 1 | empty |
| **Size** (`size`) | Control size. | `(default)` / `sm` / `md` / `lg` | empty |
| **Disabled** (`disabled`) | Bindable condition that locks the field. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition gating whether the field renders. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-textarea` has **no `variant` field** — it inherits the app's theme tokens.

> **Migration note (P229):** the height field used to be called `rows`. It is
> now `lines`; a legacy `rows` is migrated losslessly when the node is opened in
> the editor, and the runtime still reads `rows` from old deployed configs.
> There is no `rows` editor row any more.

### Value / Write To / Write Trigger

Same model as the whole input family (see [Forms](../guides/forms.md)): bind
**Value** and **Write To** to the same store sub-path for true two-way binding.
Store writes are per-client and re-render bound views live; `flow`/`global`
writes are server-side and do not re-render. The write-back is additive — the
`change`/`submit` events fire either way.

## Inputs

`ui-textarea` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null) | Updates the node's `value` and pushes a fresh snapshot to the app's clients. |
| `msg.ui.patch` | Overwrites definition fields (`placeholder`, `lines`, `maxLength`, `disabled`, …). Binding-backed fields as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `focus`, `reset`. |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-textarea` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | on every edit of the text | `value` — the current text |
| `submit` | on the submit gesture (Ctrl+Enter / leaving the field) | `value` — the confirmed text |

Both carry `appId`, `clientId`, `event` and `sourceId` on `msg.ui`.

## Examples

### 1. A comment box with counter and live preview

A `draft` store, a `ui-textarea` (6 lines, max 200 characters) whose Value and
Write To point at `draft.comment` with trigger `change`, and a `ui-text` that
mirrors the same slice.

Flow file: [`examples/guide/ui-textarea.json`](../../../examples/guide/ui-textarea.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-textarea.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideTextarea/` and type.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [`ui-input`](ui-input.md) — the single-line sibling
- [`ui-store`](ui-store.md) — the usual Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-textarea.md`
