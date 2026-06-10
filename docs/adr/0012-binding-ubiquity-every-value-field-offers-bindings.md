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
| **Value / display** | `label`, `message`, `value` (badge **and** the input-control `value`), `src`, `text`, `initials` | **full set** | — (this is P113) |
| **Boolean state** | `disabled` (and later `hidden`/`readonly`) | Store, Query, Route-Param, Reactive, msg, JSONata, **boolean**, Flow, Global, Env | string / number / json / timestamp — a boolean can't hold them |
| **URL / path** | `href` (ui-button link mode), `to` (ui-action) | str, msg, JSONata, Store, Reactive, Flow, Global, Env | number / boolean / json / timestamp — not a URL |

**Correction (2026-06-10) — the input-control `value` is *not* a reduced
category.** An earlier draft listed it separately as "two-way → Store/State
only". That conflated two different things: the **write-back target** (where a
control persists what the user types — a separate field, `valuePath`/`storeId`,
which is and stays a state/store target) versus the `value` **binding** itself,
which is the *display / initial* value and legitimately takes the **full value
set**. The shipped nodes confirm this: ui-checkbox (P97) and ui-datepicker
(P98) already bind `value` with the full meaningful set. So input-control
`value` belongs to the **Value/display** row; the reduced row is removed.

`disabled` specifically **must** offer the Store binding (owner: "unbedingt
nötig") — driving a control's enabled state from app state is a core use case.

**Runtime already supports this (discovered 2026-06-10).** The renderer already
resolves `disabled` as a binding (`resolveBinding(component.bind.disabled)`) and
`href` as a binding (P71: webapp.js normalises a literal and routes a dynamic
`bind.href`; the renderer resolves it). The binding-object schema is generic
(P97 bound `value`). **So the gap is purely in the editor** — the node HTMLs do
not yet offer `value`/`disabled`/`href` as typedInputs. No schema/runtime
foundation package is needed; the foundation is just the editor helper's
category type-sets (P113).

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
- The `disabledPath` raw-text pattern (today only ui-button) is now officially
  legacy: it becomes a boolean-state typedInput with a Store binding. `disabled`
  is planned across **all interactive nodes** (the input controls + ui-button),
  greenfield where the node has no disabled field yet; static display nodes
  (ui-text/-badge/-image/…) do not get `disabled` (no interaction to disable).
- **Decomposition (owner: "Fundament + 1 Paket pro Knoten", parallel):**
  - *Tier 0 — foundation (folded into P113):* the editor helper delivers the
    category type-sets — Value/display (full set), boolean-state, url-path. No
    separate schema/runtime package (runtime already resolves disabled & href
    bindings; the value-as-binding shape is generic and proven by P97/P98).
  - *Tier 2 — one editor-only package per node, parallel-safe* (each touches
    only its own `nodes/<x>.html` + spec + test catalogue; depends on P113):
    - **ui-button** — `disabledPath`→boolean-state typedInput + `href`→url-path
      typedInput (label already P113).
    - **ui-input / -select / -switch / -slider / -radio / -textarea** —
      `value`→canonical typedInput (full set; `valuePath`→state-binding
      migration as in P97/P98; write-back target `valuePath`/`storeId`
      unchanged) **and** a new bindable `disabled` (boolean-state).
    - **ui-checkbox / -datepicker** — `value` already done (P97/P98); add
      bindable `disabled` only.
- No reduction may be added silently: a field that offers fewer than the full
  set must reference its category (and thereby this ADR) in code and spec.
