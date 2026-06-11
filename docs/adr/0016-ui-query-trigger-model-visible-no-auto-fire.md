# ADR 0016: ui-query trigger model — visible triggers, per-client, no autonomous auto-fire

- Status: accepted
- Date: 2026-06-11
- Builds on: P112 (route lifecycle `onEnter`/`onLeave` on every arrival), P15
  (per-client state / multi-user), [ADR 0011](0011-ui-action-navigation-target-modes-and-dual-path-coding.md)
  (wire vs reference duality). Governs P160/P161.

## Context

How does a `ui-query` get triggered to (re)load from the backend? An earlier
draft proposed an **automatic** mode: the query self-fires on client arrival and
on params change, bypassing any visible wire. The owner objected (2026-06-11):
that means the query receives a frontend event *past* the visible `onEnter` — it
saves wiring but is **completely intransparent** (a DB call from nowhere, not
traceable in the flow).

The resolving principle: the wire-vs-reactive duality does **not** transfer
cleanly to triggers. **Reactivity (hidden/automatic) is fine for *reads*** (a
display binding has no side effect) — **but a side-effecting *trigger* (a DB
call) must be visible.** A DB fetch with no visible cause cannot be debugged,
rate-limited, or reasoned about.

## Decision

### 1. No autonomous auto-fire

`ui-query` does **not** self-trigger from a hidden frontend event. **Every
backend fetch hangs on a visible cause** — a wire or a declared config
reference.

### 2. Initial / arrival load — the `onEnter` wire

The first (and every re-arrival) load is triggered by **`route onEnter →
ui-query`** (a wire). `onEnter` already fires per arrival (P112: deep-link,
refresh, navigate) and carries the **`clientId`**, so the load is per-client.
Cost: one wire — worth the transparency. (The long-wire ergonomics are addressed
by the proposed `ui-event` node — see Consequences.)

### 3. Refresh (paging / sort / search) — the declared `params` reference

The query reacts to its **declared `params`-store reference** (the `params`
field): a config-visible reactive dependency ("this query depends on this
store"), not hidden magic. When the params store changes, the query re-fetches
(via its out-port → wired fetch). Authors who want a fully wired path may instead
wire the **store's change out-port → ui-query**. Optional `debounceMs` on the
query (default: immediate) for search-typing.

### 4. The principle, stated once

- **Reads** (display values) may be reactive/automatic (bindings) — no side
  effect, transparency not at risk.
- **Triggers / side effects** (DB fetch) must be **visible**: a wire (`onEnter`,
  store change-out) or a **declared reference** (`params`). **No hidden
  autonomous trigger.**

### 5. Per-client

Query **data and triggers are per-client** (P15 model): `onEnter` carries the
`clientId`, the data lives per-client under `ui.queries.<path>`, the wired fetch
pushes the result back to that client (`msg.ui.clientId`). Broadcast (shared)
remains possible when no clientId is targeted.

## Consequences

- **P160** (ui-query spec cleanup) documents this trigger model + the principle;
  **P161** (reactive paging) is reshaped: initial = `onEnter` wire, refresh =
  declared `params` (no auto-on-arrival).
- The `onEnter`-wire requirement raises a long-wire ergonomics concern. The
  proposed **`ui-event` node** (P162) is the answer: a **reference-based local
  tap** of the app/route lifecycle events (like Node-RED `link in`/`status`/
  `catch`) — placed next to the query, it surfaces `onEnter`/`onLeave` locally
  with a short wire, keeping the trigger **visible** without dragging a wire
  across the canvas. It is the *reference* arm of the wire-vs-reference duality
  for lifecycle events.
- No schema/runtime change to the trigger contract beyond making the existing
  `onEnter`/`params` paths the canonical, documented way.
