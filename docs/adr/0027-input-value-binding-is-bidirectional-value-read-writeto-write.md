# ADR 0027: input value binding is bidirectional — `value` reads, `writeTo` writes; symmetric typedInputs

- Status: accepted
- Date: 2026-07-08
- Builds on: [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md)
  (binding ubiquity; its own note that the write-back target "is and stays a
  state/store target") and [ADR 0010](0010-reactive-binding-client-expressions.md)
  (the canonical binding kinds). Supersedes the ui-input `storeId`+`path`
  write-target pair and the legacy `valuePath` read field.

## Context

An input control (ui-input and its siblings) needs two things: a **source** to
display and a **target** to persist what the user types. Today that is three
overlapping, confusingly-labelled fields, and the write half does not work:

- **`value`** — the P123/ADR 0012 canonical binding (typedInput, full kind set),
  labelled „Value Path" in the editor. This is the **read/display** source and
  works.
- **`storeId` + `path`** — a ui-store node picker + a text path, documented (node
  help + `docs/nodes/input/ui-input.md`) as *„wohin die Nutzeränderung
  gespeichert wird"* — the **write-back** target. **Verified 2026-07-05: the
  runtime writes nothing through them.** No client or server code persists a
  change via `storeId`/`path`; they survive only as a legacy read-source
  fallback. The field pair is present in the editor and the docs but dead.
- **`valuePath`** — a pre-P123 plain state path, kept in `defaults` for migration
  only, not shown.

The result: a user who binds `value = store(x).name` sees the value but must wire
`change → function → ui-store` by hand to persist it; the two „...Path" labels and
the dead write-back make the model opaque. The owner's framing (2026-07-08):
*„macht es nicht sinn, value und ‚write out' gleich aufzubauen? Nur für das
Schreiben machen die anderen Types keinen Sinn. Aber so würde es einheitlich
aussehen und dem Benutzer einfacher machen."*

## Decision

**An input's value binding is bidirectional, expressed as two symmetric
typedInputs that differ only in their kind set:**

1. **`value`** — the **read** source. Full canonical kind set (Store, Query,
   Route-Param, Reactive, literal, msg, JSONata, Flow, Global, Env). Unchanged;
   its editor label becomes **„Value"** (it is a binding, not a path).

2. **`writeTo`** (new) — the **write** target. Same typedInput look (incl. the
   Store node-picker + optional sub-path), but only the **writable** kinds:
   **Store** (a `ui-store` node + optional one-level sub-path), **Flow**, and
   **Global**. The non-writable kinds (Query, Route-Param, Reactive, literal,
   msg, JSONata, Env, timestamp) are omitted — you cannot persist a user edit
   into a computed/read-only source. Replaces `storeId` + `path`.

3. **`writeTrigger`** (new) — `change` | `submit`, **default `submit`**. Text
   controls persist on submit (Enter / blur); non-text controls (checkbox,
   switch, select, radio, slider — which have no submit gesture) persist on
   `change` regardless of the setting.

4. **The runtime implements the write-back** (today missing). On the trigger
   event the control's current value is persisted to the `writeTo` target:
   - **Store** → applied as a per-client store operation (`op:set` at the store's
     `statePath` + the sub-path), carrying the browser `clientId`, so it honours
     the P15 per-client model and pushes a fresh snapshot over SSE (the bound
     view updates live — no wiring).
   - **Flow / Global** → written to Node-RED flow/global **context** server-side.
     This deliberately lives **outside** the app-state model: no per-client
     scoping and no automatic SSE re-render (accepted owner trade-off).

5. **Migration.** `storeId` + `path` → `writeTo = {kind:"store", path:<storeId>,
   subPath:{kind:"literal", value:<path>}}`. Legacy `valuePath` → `value =
   {kind:"state", path:<valuePath>}`. The old fields are read on open for
   back-compat and then dropped from the contract.

6. **Uniform across every input control:** ui-input, ui-select, ui-checkbox,
   ui-switch, ui-textarea, ui-slider, ui-radio, ui-datepicker.

## Consequences

- **True two-way binding with zero wiring.** `value = store(x).name` +
  `writeTo = store(x).name` makes the field read and persist the same slice; the
  common case ("edit this entity field") needs no function node.
- **One consistent mental model.** Two typedInputs that look alike; the only
  difference is "read can come from anywhere, write must go to a real target."
- **The dead fields and the doc/impl mismatch are removed.** `storeId`/`path`/
  `valuePath` disappear from the contract; the docs stop promising a write-back
  that never fired.
- **Flow/Global writes are a documented limitation:** they bypass per-client
  state and do not auto-re-render (a subsequent snapshot push is needed to
  reflect them). Store is the first-class, reactive target.
- **Cross-cutting change:** `packages/schema` (the `writeTo`/`writeTrigger`
  contract + writable-kind category), `resources/lib/editor-common.js` (a
  symmetric write-target typedInput helper), the runtime write-back on the input
  change/submit path, all 8 input nodes, and their docs. Sequenced as a
  **foundation** package (contract + helper + runtime + migration, proven on
  ui-input) followed by a **rollout** package to the remaining seven controls.
- **Verification is behavioural:** the proof is that typing into a bound input
  and submitting **mutates the store slice and live-updates a second bound view**
  (measured), not that an editor field exists.
