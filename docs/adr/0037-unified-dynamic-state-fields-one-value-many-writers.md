# ADR 0037: dynamic-state fields are ONE per-component value — bound store or internal per-client slot, written by binding / msg / duration / interaction verbs

- Status: accepted
- Date: 2026-07-14
- Unifies / re-scopes: [ADR 0036](0036-message-mode-applies-to-every-msg-bound-field.md)
  (msg drives every field → P223), [ADR 0015](0015-common-base-fields-and-editor-structure.md)
  (`visible`/`disabled` base fields → P222), the parked ui-alert duration↔visible
  redesign, and the imperative `show`/`hide` verbs. Builds on the per-client state
  machinery (P201) and the reactive binding resolution (ADR 0010/0013).

## Context

Visibility (and `disabled`) is touched by several mechanisms that today do **not**
share a value, which is why the model is confusing (owner: *"ich hab die übersicht
verloren"*):

- **Declarative `visible` → `visibleIf`** — reactive, resolved per snapshot. The
  server-side truth. But the editor field is missing on ~26/33 nodes (P222), and
  the `msg` binding type is inert on it (P223).
- **Imperative `ui-action` show/hide** — a **client-side** overlay
  (`interaction.hidden` → CSS `.webapp-hidden`), separate from the declarative
  value, and not wired for ui-alert at all.
- **`msg`** — only drives a node's primary field, never `visible` (P223).
- **Duration** (ui-alert) — a client-side one-shot close plus an `autoDismissed`
  flag, decoupled from `visible`.

Each prior package fixed a fragment. The owner (2026-07-14) instead articulated the
**target model** that unifies them:

> *"Das muss alles gehen. Wenn ich binde, ändere ich implizit den gebundenen Wert
> im Store. Ohne Binding muss die Visibility-Value in der Komponente (dem Knoten)
> gehalten werden. Duration ändert das genauso intern. Msg von außen."* — and it
> *"sollte für alle Felder gelten, die gebunden werden können und die einen
> dynamischen Zustand des Knotens abbilden wie Visible, Disabled, etc. Statische
> Felder brauchen das erstmal nicht (Color, Size, etc.)."*

## Decision

Introduce the notion of a **dynamic-state field** — a bindable field that
represents a **runtime state** of a component (`visible`, `disabled`; extensible).
`color`/`size` and other **static presentational** fields are explicitly **not**
dynamic-state fields and keep today's model.

For every dynamic-state field, there is **exactly ONE resolved value per component**
(what the renderer reads — `visibleIf`/`enabledIf`), with a single source rule and a
single write rule:

1. **Source — where the value lives:**
   - **Bound** (`store`/`state`/`reactive`/`query`/`routeParam`): the **bound source
     is the truth**, resolved reactively per snapshot (unchanged).
   - **Unbound** (literal / none): the component holds the value in an **internal
     per-client slot** — the same per-client state machinery as ui-store (P201),
     keyed by component id + field. Default = the field's neutral value (`visible` →
     true, `disabled` → false).

2. **Writers — everything mutates that ONE value:**
   - **Binding write** — when bound, any mutation writes **through to the bound
     store** (respecting the store's scope: per-client or shared), so the store stays
     the single truth. When unbound, the mutation writes the internal slot.
   - **`msg`** — Message mode (ADR 0036 / P223): the configured message property
     sets the value.
   - **Duration** (ui-alert) — on expiry, sets `visible = false` **as a state
     transition** (replaces the client one-shot + `autoDismissed` hack); re-showable
     by writing the value again.
   - **Interaction verbs** — `ui-action` `show`/`hide` (and `enable`/`disable`)
     **write the value** instead of pushing a separate client overlay. The imperative
     verbs become a second way to change the one truth, not a parallel system.

3. The renderer is unchanged in spirit: it reads the one resolved value
   (`visibleIf`/`enabledIf`); the difference is that unbound dynamic-state fields now
   have a live per-client value the render reads, and all writers converge on it.

## Consequences

- **One mental model:** "a component's visibility/enabled is one value; bind it
  (then the store is the truth) or leave it unbound (the node holds it); message,
  duration, and show/hide all set that same value." The dual declarative/imperative
  confusion collapses.
- **Duration becomes declarative** and re-triggerable; the `autoDismissed` client
  hack retires.
- **`show`/`hide` unify** with the declarative value; the `interaction.hidden`
  overlay is retired for visibility (verbs write state). `enable`/`disable` follow
  for `disabled`.
- **Generalises to all dynamic-state fields** (visible, disabled, …), not visibility
  alone; static fields (color/size) are untouched.
- **Build (staged):** a foundation (the internal per-client dynamic-state slot +
  the unified write API: bound→store, unbound→slot; renderer reads it) → then the
  writers fold in: `msg` (P223, in flight), duration-as-transition, verbs-write-value.
  P222 (editor field rollout) stays complementary (the field must exist to bind).
- **Re-scoping:** P223 becomes the `msg` writer slice; the parked ui-alert duration
  redesign and the show/hide gap become writer slices under this ADR. Roadmap:
  P224 (foundation), P225 (duration transition), P226 (verbs write value).
- **Open detail for the foundation:** per-client slot lifecycle (eviction/TTL — cf.
  the P210 per-client-scale tech-debt) and whether an unbound dynamic-state slot is
  addressable like a store. Decided in P224.
