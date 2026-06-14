# ADR 0020: display options are semantic intents, mapped per backend (not backend-specific enums)

- Status: accepted
- Date: 2026-06-14
- Builds on: the `variant` convention ([[variant-means-color-convention]] —
  semantic colour mapped per backend), `docs/nodes/concepts/theming.md`
  (`displayType` vs `variant`), [ADR 0017](0017-ui-repeat-template-container-render-time-scope.md)
  (ui-list = leaf styled list vs ui-repeat = free subtree). Relates to **P102**
  (backend-support helper + capability map, deferred — needs a 2nd backend).
  First applied to `ui-list`.

## Context

`ui-list` renders today as a bare `<ul>/<li>` — unsatisfying; if that is all it
is, there is no reason to use it over `ui-repeat`. The owner's mental model is a
**boxed list** (Bootstrap `list-group`), though a plain list is also legitimate.

This surfaces a general problem the owner named precisely: **a backend's style
bleeds through** (the `badge` look is a Bootstrap idiom; Shoelace renders
`<sl-badge>`). The owner wants **per-backend options** — e.g. for Shoelace an enum
`ul | ol | tabular`.

Two ways to model backend-dependent presentation:

1. **Backend-specific option sets** — the editor offers a *different* enum per
   active backend. Full access to each backend's idioms, but: a backend switch
   **orphans** the config, the editor must be backend-aware, and the AppModel
   carries backend-specific values.
2. **Semantic intents, mapped per backend** — a small, stable, backend-neutral
   vocabulary that each backend's adapter translates into its idiom (exactly how
   `variant` already works for colour). Portable; a backend switch keeps working.

Decisive constraint: **there is only one backend (Shoelace) today.** Building
backend-specific enums now would **bake Shoelace in** — the very bleed the owner
objects to. The machinery to do per-backend options *properly* (capability map +
per-backend mapping + switch warnings) is **P102**, parked behind a second backend.

## Decision

### 1. Display options are semantic intents (owner choice)

A node's presentation options are a **small backend-neutral semantic vocabulary**
("what role/shape", not "which backend tag"). Each backend **adapter** maps the
intent to its idiom. This extends the existing `variant`=semantic-colour rule to
*display shape*. Flows stay portable across backends.

### 2. Backend-specific option sets wait for P102 + a 2nd backend

We do **not** introduce per-backend enums (e.g. Shoelace `ul/ol/tabular`) now.
Bespoke, backend-scoped *refinements* are a later, **advanced** layer on top of the
semantic intent — added once the backend-support infrastructure (P102: capability
map, per-backend mapping, switch warning) and a **second** real backend exist to
validate them. Designing them against one backend would hard-code it.

### 3. ui-list is the styled-list node; the look is its value

`ui-list` deliberately gives up per-row control in exchange for a **polished,
backend-styled list** — that styling is *why it exists* alongside `ui-repeat`
(free subtree) and `ui-table` (columns). So ui-list **leans into** a richer look,
including a boxed/grouped form. **Tabular** display is **not** a ui-list option —
that is `ui-table` (keeps the boundary crisp).

### 4. First application — ui-list `displayType`

`displayType` becomes the semantic display-intent enum:
`plain` · `divided` · `grouped` (boxed / list-group) · `actionable`
(clickable/hover rows, pairs with `itemClick`/`selectable`), plus an orthogonal
`ordered` (unordered `ul` vs ordered `ol` — itself backend-neutral). The Shoelace
adapter maps each (`grouped` → bordered card-like rows, etc.). Density (`compact`)
is a separate modifier, not a look.

## Consequences

- **P180** applies this to `ui-list` (intent enum + `ordered` + Shoelace mapping +
  migration of the old `default/divided/compact`); spec + tests updated.
- The general rule — **semantic intents, adapter-mapped; backend-specific options
  only via P102** — is the standing answer to "the backend style bleeds through".
  Future nodes follow it; `theming.md` documents it.
- No backend-specific machinery is built now; P101/P102 remain the home for
  per-backend capability handling + warnings.
- ui-list↔ui-repeat↔ui-table boundary is documented: list = styled rows from a
  data array; repeat = arbitrary subtree ×N; table = columns.
