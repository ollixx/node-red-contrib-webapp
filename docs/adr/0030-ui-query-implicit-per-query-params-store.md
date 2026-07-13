# ADR 0030: every ui-query owns an implicit per-client params store, addressable like any store

- Status: accepted
- Date: 2026-07-13
- Builds on: [ADR 0016](0016-ui-query-trigger-model-visible-no-auto-fire.md) (the
  query trigger model + `params`-store observation, P161), [ADR 0013](0013-store-binding-subpath.md)
  (store = node id + sub-path), [ADR 0028](0028-store-reads-are-a-separate-reference-node.md)
  / [ADR 0029](0029-state-action-nodes-store-action-query-action-hybrid.md) (the
  reference-based store read/action nodes that will target it).

## Context

A `ui-query` needs parameters — page, sort, search. Today the flow author must
**manually create a `ui-store`** and wire it into the query's `params` reference;
there is no wire-based variant. That is boilerplate for the single most common
case (a paged/searched list), and the store only exists to hold the query's own
params.

Owner (2026-07-13): *„Im Moment speichert query alle parameter in einem store, den
man auswählt … warum legen wir für ein ui-query nicht automatisch einen
gleichlautenden store für params mit an? Das Interface von ui-store könnte man
trotzdem anbieten und zwar über die ui-store actions."* Chosen shape: an **implicit
slice**, not an auto-created node.

## Decision

**Every `ui-query` implicitly owns a per-client params store slice — no separate
node — and it is addressable exactly like any `ui-store`.**

- **Storage:** the query's params live in a per-client slice
  (`ui.queries.<queryPath>.params`, per-client via `clientId`). No node is created.
- **Addressing:** a `store` reference (in `ui-store-action`, `ui-store-read`, and
  `store` value-bindings) may point at a **`ui-query`** — it resolves to that
  query's params slice (id = the query's node id). The store **picker** (`stores`
  preset) lists these query-params targets alongside real `ui-store` nodes,
  labelled e.g. *„Query X · Params"*, so they are selectable in the editor.
- **The store interface is fully available via the state nodes:** write params with
  `ui-store-action` (`set`/`patch`/…), read them with `ui-store-read`, bind to them
  with a `store` binding — all against the query's implicit params store.
- **Reactive refresh unchanged:** a change to the implicit params slice fires the
  query's out-port refresh, exactly as an explicit `params` store does today (P161).
- **Back-compat / override:** the explicit `params` field stays optional — set it to
  an **external** `ui-store` to share params across queries; **empty ⇒ the implicit
  per-query store is used** (the new default). Existing flows with an explicit
  `params` store keep working.
- **Scope:** per-client (paging/search is per user).

## Consequences

- **No boilerplate:** a paged query works without hand-creating and wiring a params
  store; the params store is there implicitly.
- **Consistent surface:** the same `ui-store-action` / `ui-store-read` / `store`
  bindings drive the query's params — the owner's *„Interface über die ui-store
  actions"*. No new params-specific API.
- **Picker + resolution changes:** the `stores` reference preset must surface
  implicit query-params targets; store-binding/action/read resolution must map a
  `ui-query` reference to its params slice. This is the bulk of the work.
- **Two ways, one model:** external explicit `params` store (shared) vs implicit
  per-query store (default) — both resolve through the same store mechanism.
- Verification is behavioural: writing the implicit params store (via
  `ui-store-action` targeting the query) changes the query's params and fires the
  refresh; a `store` binding to the query reads them back — measured, not by
  field presence.
