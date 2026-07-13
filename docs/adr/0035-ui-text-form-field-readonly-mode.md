# ADR 0035: ui-text gains a read-only "form field" presentation mode

- Status: accepted
- Date: 2026-07-13
- Relates to: the form input nodes (`ui-input`, `ui-select`, …) and their
  label+control layout; [ADR 0021](0021-display-intents-semantic-backend-mapped.md)
  (display intents mapped to the backend).

## Context

A form built from `ui-input` / `ui-select` / … renders each control as a
**labelled row** (label left / control right, consistent spacing and typography).
Some form values are **read-only** and should be *shown, not edited* — the
owner's motivating case is the **`_id` field in the Entity Editor**: it belongs in
the form next to the editable fields, with the same label treatment, but it is a
plain value, not an input.

Today the only display primitive is `ui-text`, which renders as **free display
text** — it has no form-control styling, so dropping it into a form looks
misaligned (no label column, different type scale) next to the real controls.
There is no way to show "a labelled value that looks like a control but isn't one".

Owner (2026-07-13):

> „Wir brauchen ggf. eine Lösung für Formulare, die neben den Controls auch einen
> einfachen Text mit Label anzeigen können, genauso gestyled wie die Controls.
> Beispiel: ID-Feld in Entity Editor."

## Decision

**`ui-text` gains an optional read-only *form-field* presentation mode.** When
enabled, `ui-text` renders as a **labelled form row** — a `label` on the left and
its (bound) value on the right — using the **same field layout and typography as
the input controls**, so it lines up with `ui-input`/`ui-select` in a form. It
stays **read-only** (display only; no editing, no value emission).

- Implemented as a **new option on `ui-text`** (e.g. a presentation/`display`
  choice or a boolean `asFormField`), **not** a new node and **not** a change to
  `ui-input` — `ui-text` already owns "display a value"; this is a second
  presentation of that same value. (Rejected alternatives: a dedicated
  `ui-field`/`ui-readonly` node — redundant with `ui-text`; a read-only mode on
  `ui-input` — conflates an *input* with a *display* and drags in value/binding
  semantics that do not apply.)
- The field's **`label`** reuses the form label slot; the **value** reuses the
  form control's value styling (the read-only look of the Shoelace control, e.g.
  an `sl-input readonly`/plain-text cell), so it is visually a control cell without
  being interactive.
- The value is bound exactly as `ui-text` already binds (`value` typedInput incl.
  the `store` sub-path binding), so `store:EntityEditor._id` renders the id in the
  form row — and, per ADR 0032, renders **empty** until `_id` exists.
- Non-form (default) `ui-text` behavior is unchanged.

## Consequences

- **Forms can mix editable controls and labelled read-only values** with one
  consistent look; the Entity-Editor `_id` case is expressible without a hack.
- **No new node type** — lower surface area; `ui-text` stays the single display
  primitive, now with two presentations (free text / form-field row).
- Build: schema (the new `ui-text` field + its allowed values/default), renderer
  serializer (emit the form-field row shape), the Shoelace adapter / frontend
  (render the labelled read-only cell matching control styling), editor (the new
  option + its dependency on `label`), spec (`docs/nodes/display/ui-text.md`) and
  the ui-text test catalogue. One node-scoped roadmap package.
- Interaction with ADR 0032: an unresolved/absent bound value in the form-field
  row follows the same empty-vs-`?` rules (and, once ADR 0034 lands, the per-field
  `onMissing` selector applies here too).
