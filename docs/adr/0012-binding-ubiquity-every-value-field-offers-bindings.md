# ADR 0012: binding ubiquity — every value field offers bindings by default

- Status: accepted
- Date: 2026-06-10
- Builds on: [ADR 0010](0010-reactive-binding-client-expressions.md) (the
  `reactive` kind) and the canonical value-binding type set planned in **P113**
  (`docs/roadmap/aspects/editor/P113-canonical-value-binding-types.md`).
- Scope note: this ADR states a **principle and a field-category matrix**. It
  does **not** create implementation packages — those are listed as future work
  in Consequences and cut later (owner decision, 2026-06-10: "nur Prinzip-ADR
  jetzt").

## Context

The owner's principle was captured only as a P113 findings line — *"eigentlich
brauchen wir immer die selben types, wenn es um values geht"* — and P113 then
narrowed it to **display values**, explicitly excluding input-control `value`
and never addressing the `disabled` state. ui-button's `label` is therefore on
a plan (P113), but its `disabled` (today a raw `disabledPath` text field) and
`href` are not — and the same raw `disabledPath` pattern exists on ui-switch,
ui-select, ui-input, ui-datepicker, ui-slider, ui-radio, etc.

The owner restated the principle more strongly (2026-06-10): *"Wir hatten
irgendwo aufgeschrieben, dass alle values möglichst immer auch alle Bindings
bekommen sollen. Gerade bei Disabled ist ein Store-Binding unbedingt nötig. Das
gilt für alle values in allen Knoten. Reduzieren wollen wir nur da, wo es
zwingend oder sinnvoll ist."*

So the default is **maximal binding availability**, and any reduction must be
**explicit and justified** per field — not the other way round.

## Decision

### 1. The principle

**Every value-bearing field of every `ui-*` node offers bindings by default.**
A field is rendered as a typedInput whose binding kinds come from the canonical
set (P113 / ADR 0010). Reductions are the exception and must be justified by
semantics — a binding kind is omitted only when it is **impossible** (cannot be
written back, cannot be evaluated) or **meaningless** (a literal sub-type that
the field can never hold). Reactive sources — **Store, Query, Route-Param,
Reactive** — are essentially **always** available, because reading current
state into any value is always meaningful.

### 2. Field-category matrix

The canonical full set (P113, 14 kinds): Store, Query, Route-Param, Reactive,
msg, JSONata, string, number, boolean, json, timestamp, Flow, Global, Env.

| Category | Examples | Offered kinds | Removed — and why |
|---|---|---|---|
| **Display value** | `label`, `message`, `value` (badge), `src`, `text`, `initials` | **full set** | — (this is P113) |
| **Boolean state** | `disabled` (and later `hidden`/`readonly`) | Store, Query, Route-Param, Reactive, msg, JSONata, **boolean**, Flow, Global, Env | string / number / json / timestamp — a boolean can't hold them |
| **Input-control value** (two-way) | `value` of ui-input/-select/-checkbox/-switch/-slider/-datepicker/-textarea | Store, State, + a literal default in the control's own type | msg / JSONata / Reactive / Flow / Global / Env — they are read-only sources and a control must *write back*; only a bidirectional binding (store/state) is a valid target |
| **URL / path** | `href` (ui-button link mode), `to` (ui-action) | str, msg, JSONata, Store, Reactive, Flow, Global, Env | number / boolean / json / timestamp — not a URL |

`disabled` specifically **must** offer the Store binding (owner: "unbedingt
nötig") — driving a button's enabled state from app state is a core use case.

### 3. Reductions are declared, not implicit

The canonical helper (P113's `valueBindingTypes()` and friends) gains the notion
of a **field category** so a node declares which category a field belongs to and
gets exactly that category's kinds. A field with no declared category defaults
to the **display-value full set** — the safe, maximal default. This makes "all
values get all bindings" the path of least resistance and forces any reduction
to be a conscious, reviewable choice in code.

## Consequences

- The principle is now durable (this ADR + `docs/nodes/concepts/editor.md`),
  not a P113 footnote. P113 is reframed as the **first application** (the
  display-value category) of a broader rule, not the whole rule.
- The `disabledPath` raw-text pattern across many nodes is now officially
  legacy: it should become a category-`boolean` typedInput with a Store binding.
- **Future packages to cut (not created here, owner decision):**
  1. *Field-category support in the canonical helper* — extend P113's helper
     with the matrix above (foundation for the rest).
  2. *Bindable `disabled` (cross-cutting)* — replace `disabledPath` on every
     node that has it with the boolean-state typedInput (Store included);
     migration of stored configs.
  3. *ui-button `href` as typedInput* — the URL/path category (aligns with the
     ui-action `to` work, ADR 0011 / P118-P119).
  4. *Input-control `value` binding* — give the two-way `value` fields the
     Store/State binding + literal default, per the matrix.
- No reduction may be added silently: a field that offers fewer than the full
  set must reference its category (and thereby this ADR) in code and spec.
