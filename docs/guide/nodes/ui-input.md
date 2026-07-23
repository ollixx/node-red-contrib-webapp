# ui-input

A single-line text field whose value reads from client state and writes back
into a store — no wiring needed.

> Deutsch: [de/nodes/ui-input.md](../de/nodes/ui-input.md)

## Purpose

`ui-input` renders one single-line entry field (`text`, `email` or `number`)
and connects it to your app's state in **both directions**: **Value** is the
read half (what the field shows), **Write To** is the write half (where the
user's edit is persisted). It is the workhorse of the input family — see
[Forms](../guides/forms.md) for the shared model.

## When to use

- A form field for a name, an email address, a number, a search term.
- Anywhere you want two-way binding to a store slice without a `function` node.
- Not for multi-line text — use [`ui-textarea`](ui-textarea.md).
- Not for a fixed set of choices — use [`ui-select`](ui-select.md) or
  [`ui-radio`](ui-radio.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Input N` |
| **Parent Slot** (`mount`) | Where the field is placed — a slot of a `ui-app`, `ui-route`, `ui-dialog` or `ui-container`. Required. | mount picker | — |
| **Label** (`label`) | The caption shown above the field. Required. Bindable (full binding set). | binding / literal text | — |
| **Value** (`value`) | The **read** half: what the field displays. Bindable with every binding kind — typically a `store` binding with a sub-path. | binding | — |
| **Write To** (`writeTo`) | The **write** half ([ADR 0027](../../adr/0027-input-value-binding-is-bidirectional-value-read-writeto-write.md)): where the user's edit is persisted. Only *writable* kinds are offered — `store` (a `ui-store` + optional one-level sub-path), `flow`, `global`. Leave empty for "no automatic write-back". | `store` / `flow` / `global` | empty |
| **Write Trigger** (`writeTrigger`) | When the write happens. `submit` = on Enter/blur; `change` = on every keystroke; `none` = never (you wire the persistence yourself from the `change` event). | `submit` / `change` / `none` | `submit` |
| **Input Type** (`inputType`) | Semantic entry type — selects keyboard type and the browser's native validation. Required. | `text` / `email` / `number` | `text` |
| **Variant** (`variant`) | Visual field role. | `default` / `filled` / `outlined` | `default` |
| **Size** (`size`) | Control size. Empty leaves the backend default. | `(default)` / `sm` / `md` / `lg` | empty |
| **Disabled** (`disabled`) | Bindable condition that locks the field. A truthy store value disables it live. | binding (boolean set) | unset |
| **Visible** (`visible`) | Bindable condition that gates whether the field renders at all. | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot; which of them apply depends on the parent's layout preset — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

> **Placeholder:** the schema and runtime accept a `placeholder` on
> `ui-input`, but the **editor has no Placeholder row** for this node — it can
> only be set by hand-editing the flow JSON or via `msg.ui.patch`. (The
> contract doc `docs/nodes/input/ui-input.md` still lists it as an editor
> field; see [Known gaps](#known-gaps).)

### Value / Write To / Write Trigger in one paragraph

The two look-alike typedInputs are deliberately separate. Bind **Value** and
**Write To** to the *same* store sub-path and the field becomes truly
bidirectional: it shows the slice and persists edits back into it, and every
other view bound to that slice re-renders live. Store writes are per-client
and push a fresh snapshot over the live stream; `flow`/`global` writes are
server-side and do **not** trigger a re-render. The write-back is **additive** —
the `change`/`submit` output events fire regardless.

## Inputs

`ui-input` **has an input port**.

| Message | Effect |
|---|---|
| `msg.payload` (non-null) | Updates the node's `value` and pushes a fresh snapshot to the app's clients — e.g. pre-fill the field from an `inject`. |
| `msg.ui.patch` | Overwrites arbitrary fields of the node definition (`placeholder`, `disabled`, `inputType`, …). Binding-backed fields must be passed as binding objects. |
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable`, `focus`, `reset` (back to the configured initial value). |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-input` **has one output port**.

| Event | When | `msg.ui.params` |
|---|---|---|
| `change` | on every change of the field value | `value` — the new value |
| `submit` | on Enter / submit | `value` — the confirmed value |

Both carry `appId`, `clientId`, `event` and `sourceId` on `msg.ui`.

## Examples

### 1. A two-way bound text field with a live preview

An app with a `draft` store, a `ui-input` whose Value *and* Write To point at
`draft.name` (trigger `change`), and a `ui-text` bound to the same slice. The
store starts with `Ada Lovelace`; edit the field and the preview follows on
every keystroke.

Flow file: [`examples/guide/ui-input.json`](../../../examples/guide/ui-input.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-input.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideInput/` and type into the field.

## Known gaps

- The contract doc lists a `placeholder` **editor field**; the editor template
  does not render one (runtime + schema do support the property). Reported with
  P268.

## Related

- [Forms](../guides/forms.md) — the input family, bidirectional value/writeTo
- [Bindings & State](../guides/bindings-state.md) — the binding kinds
- [`ui-textarea`](ui-textarea.md) · [`ui-select`](ui-select.md) · [`ui-switch`](ui-switch.md)
- [`ui-store`](ui-store.md) — the usual Write To target
- Contract doc (internal, German): `docs/nodes/input/ui-input.md`
