# ADR 0026: a boolean-state base field's neutral value equals its own semantic default (visible→true, disabled→false)

- Status: accepted
- Date: 2026-07-05
- Corrects: **P181** (base-field boolean default type). P181 introduced a single
  hard-coded synthetic-default sentinel — bool literal **`false`** — for *both*
  `visible` and `disabled`. That is right for `disabled` (neutral = not disabled =
  `false`) but wrong for `visible` (neutral = visible = `true`). The consequence is
  a real defect, described below.
- Builds on: [ADR 0012](0012-binding-ubiquity-every-value-field-offers-bindings.md)
  (binding ubiquity — `visible`/`disabled` are boolean-state binding fields) and
  [ADR 0015](0015-common-base-fields-and-editor-structure.md) (the shared base
  fields visible/disabled/color/size in `installBaseFields`). Keeps: P138/P172
  (the `visible` binding + per-node rollout), P181 (the `bool` default *type* — a
  clean true/false control instead of the `str`→store fallback).

## Context

`visible` and `disabled` are the two boolean-state base fields rendered centrally
by `installBaseFields` / persisted by `applyBaseFields` in
`resources/lib/editor-common.js`. They have **opposite semantic defaults**: an
absent/empty binding means **visible = true** but **disabled = false**. The server
honours that correctly — the renderer defaults an absent `visible` to `true`
(`packages/renderer/src/renderer.ts:932`, `matchesCondition(component.visibleIf,
sources, true)`).

P181 gave both fields a `bool` default *type* (fixing the ugly store-fallback
dropdown) and, to stop an untouched empty field from persisting a synthetic
`{kind:literal,value:false}`, added a save guard: *if the field was originally
empty AND the result is the synthetic default (bool literal `false`) → persist
`null`*. It used the **same sentinel `false` for both fields**. Two problems follow,
both hitting `visible` only:

1. **Misleading display.** The bool typedInput normalises an empty value to
   **`false`** on init, so an unbound `Visible` field *shows* „false" even though
   „empty = visible". The owner (2026-07-05, on `ui-list`): *„Visibility ist dort
   hart auf FALSE, aber die Liste wird angezeigt. Default sollte TRUE sein."*

2. **A deliberate `false` is swallowed (functional defect).** Because the guard
   treats *originally-empty + value `false`* as the synthetic default and discards
   it to `null`, a user who deliberately sets `Visible = false` on a fresh node
   cannot distinguish their choice from the empty default — `applyBaseFields`
   saves `null`, so the node stays **visible**. You literally cannot hide a
   freshly-added node via the boolean `false`.

The root cause is that the neutral sentinel was tied to the *type* (`false` for a
bool), not to the *field's semantics*. Two fields with opposite defaults cannot
share one sentinel.

## Decision

**A boolean-state base field's neutral value — both its empty display and its
synthetic-default save sentinel — equals that field's own semantic default:**

| Field | Semantic default (empty ⇒) | Empty display | Synthetic-default sentinel (⇒ persist `null`) |
|---|---|---|---|
| `visible` | **true** (visible) | **true** | originally-empty **and** value === **true** |
| `disabled` | **false** (enabled) | **false** | originally-empty **and** value === **false** |

Concretely, in `resources/lib/editor-common.js`:

- **Init (`installBaseFields`):** when the field is originally empty, seed the bool
  control's displayed value to the field's neutral (`visible` → `true`,
  `disabled` → `false`) instead of letting the bool type normalise everything to
  `false`.
- **Save (`applyBaseFields`):** compare the synthetic default against the
  **per-field** neutral value (`visible` → `true`, `disabled` → `false`). An
  originally-empty field still carrying its neutral value persists as `null`
  („no binding"); **any other literal — including the opposite boolean —
  persists verbatim.**

The result: an empty `Visible` reads „true"; a deliberate `Visible = false`
persists as `{kind:literal,value:false}` and actually hides the node; `disabled`
behaviour is unchanged; stored non-literal bindings (state/store/reactive/…) pass
through untouched as before.

## Consequences

- **`visible` becomes usable as a literal switch.** Setting `Visible = false` in a
  fresh node now hides it — the case the owner found broken on `ui-list`.
- **No semantic change to `disabled`.** Its neutral was already `false`; the guard
  is only re-expressed per-field, so its stored form is identical.
- **Empty still means `null`.** An untouched field persists no binding — the P181
  invariant („leer = kein Binding") is preserved for both fields; only the
  *displayed* empty value and the *per-field* sentinel change.
- **One central site, all view nodes.** The change lives in
  `installBaseFields`/`applyBaseFields`; every node that delegates to the shared
  helpers inherits it. (Nodes that manage `visible`/`disabled` inline — see the
  P181 result list — are checked and aligned if they duplicate the sentinel.)
- **Verification is behavioural, not cosmetic.** The proof is that a deliberately
  `false` `Visible` *removes the node from the rendered DOM* (measured, not a
  class assert) and that an untouched field round-trips to `null` — asserting the
  display value alone would have missed the swallowed-`false` defect, exactly as
  P181's display-only checks did.
