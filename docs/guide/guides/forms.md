# Forms

The input family, and the bidirectional value binding: read with **Value**,
write back with **Write To** — no wiring needed.

> Deutsch: [../de/guides/forms.md](../de/guides/forms.md)

## Goal

Build a small form whose fields read from and persist into a store slice,
choose the right write trigger per control, and know how the input events
fit in.

## Prerequisites

- [Bindings & State](bindings-state.md) — stores and the Store binding.

## The input family

All input controls follow the same model: `ui-input` (single-line text,
email, number), `ui-textarea`, `ui-select`, `ui-checkbox`, `ui-switch`,
`ui-radio`, `ui-slider`, `ui-datepicker`.

Each has a **Label**, a bindable **Value**, an optional **Write To**
target with a **Write Trigger**, a bindable **Disabled** condition, and an
output port emitting `change` and (for text controls) `submit` events.

## Bidirectional binding: Value reads, Write To writes

An input needs two halves, expressed as two look-alike typedInputs:

- **Value** — the *read* source: what the field displays. Any binding
  kind works (store, query, route param, literal, msg, …).
- **Write To** — the *write* target: where the user's edit is persisted.
  Only writable kinds are offered: **Store** (a `ui-store` plus optional
  sub-path), **Flow**, or **Global** — you cannot write into a computed
  source like a query.

The common case is symmetric: bind both Value and Write To to the same
store sub-path (`draft.name`). The field then displays the slice *and*
persists edits into it — true two-way binding with **zero wiring**. Any
other view bound to the same slice (a preview text, a summary) updates
live as the user types.

Writing to a store is per-client and pushes a fresh snapshot over the
live stream. Writing to Flow/Global context is server-side and does *not*
re-render automatically — Store is the first-class, reactive target.

### Write Trigger

| Trigger | Behaviour |
|---|---|
| `submit` (default) | text controls persist on Enter or blur |
| `change` | persist on every input |
| `none` | no automatic write-back — wire the persistence yourself (`change` event → `function` → `ui-store`) |

Non-text controls (checkbox, switch, select, radio, slider) have no
submit gesture — they persist on `change` regardless of the setting.

### Events still fire

Independent of the write-back, every control emits its `change`/`submit`
events on its output port (with the current value in the params). Use
them for the flow side of a form: validate server-side, save to a
database when the user submits, close a dialog — see
[Actions & Events](actions-events.md).

## Validation behaviour

Validation today is intentionally lean:

- The **Input Type** of `ui-input` (`text` / `email` / `number`) selects
  keyboard type and browser-native validation for the field.
- The **Disabled** binding gates whether the user can edit at all — bind
  it to a store flag or a reactive expression for conditional forms.
- Business validation belongs in the flow: react to the `submit` event,
  check the values, and answer with a store update or an alert.

## Steps

1. Create an app with a `ui-store` (state path `draft`, initial value
   `{"name":"","email":"","newsletter":false}`).
2. Add a `ui-input` "Name": bind **Value** and **Write To** to the store
   with sub-path `name`, write trigger `change`.
3. Add a `ui-input` "Email" with input type `email`, Value/Write To on
   sub-path `email`, write trigger `submit` (the default).
4. Add a `ui-switch` "Newsletter" with Value/Write To on sub-path
   `newsletter`.
5. Add a `ui-text` bound to the store's `name` sub-path as a live
   preview. Deploy: typing in the Name field updates the preview on every
   keystroke; the Email field persists only on Enter/blur; the switch
   persists immediately.

## Example flow

The finished result of the steps:
[`examples/guide/forms.json`](../../../examples/guide/forms.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/forms.json` (or paste its JSON) →
   **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/formsApp/` — type into the
   fields and watch the live preview.

## Where next

- [Navigation & Dialogs](navigation-dialogs.md) — put a form into a
  dialog.
- [Displaying data](displaying-data.md) — list the records you saved.
