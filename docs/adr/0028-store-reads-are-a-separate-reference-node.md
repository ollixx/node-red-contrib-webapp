# ADR 0028: on-demand store reads are a separate reference node (`ui-store-read`), not a store op/port

- Status: accepted
- Date: 2026-07-10
- Builds on: [ADR 0013](0013-store-binding-subpath.md) (a store is
  referenced by node id + a one-level sub-path) and the reference-node pattern
  used by `ui-input.writeTo`, `ui-query.params`, and `store` bindings. Relates to
  `ui-store` (holds state; write-in + `changed`-out) and `ui-query` (external
  read-only data) — this fills the gap: reading **client state** into a flow.

## Context

A flow often needs the CURRENT value of a `ui-store` slice on demand — to persist
it to a DB, export it, sync it. `ui-store` today offers only a write input and a
`changed` output stream; its `changed` event carries the value at the *changed
path*, so per-field edits never yield the whole slice. Three options were weighed:

1. **`patch {}` trick** — a root patch that mutates nothing but emits the whole
   slice on the `changed` port. Works, but needs a marker (`msg.topic`) to tell it
   apart from real edit events, and rides the same wire as the change stream —
   pure boilerplate.
2. **A `read` op + a 2nd output port on `ui-store`.** Cleaner than the trick, but
   a single store node becomes a **fan-out bottleneck**: when several use-cases
   read the same store, everything must be wired out of that one node, and read
   triggers mix with write ops on its single input.
3. **A dedicated reader node** that references a store by id and does nothing but
   read. Owner (2026-07-10): *„Wenn mehrere usecases auf den store im backend
   zugreifen, ist das wieder zu wenig. Wie wäre es mit einem extra knoten, der auf
   einen store bindet und der NUR das read anbietet. Der könnte mehrfach genutzt
   werden."*

## Decision

**Reads are a separate, reference-based node: `ui-store-read`.** `ui-store` is
left unchanged (no `read` op, no 2nd port). `ui-store-read` can be dropped into a
flow as many times as needed — one per consumer — each referencing its store.

Contract:
- **Config:** `store` (reference to a `ui-store` node id, via the node picker),
  optional `path` (default sub-path), `parent` (owning app, required like every
  app-scoped node — see P205).
- **Input:** **every** incoming message triggers a read. Uses `msg.ui.clientId`
  for the per-client slice (same scope rule as writing: a `client-only` store read
  without a clientId is a scope error; `any`/`broadcast` reads the shared state).
- **Path resolution (dynamic override):**
  **`msg.ui.store.path` › `msg.path` › config `path` › (none = whole slice).**
  So a reader can be re-targeted at runtime without reconfiguring.
- **Output:** `msg.payload = <value>` **and**
  `msg.ui.store = { id, event: "read", path, fullPath, value, clientId }` (mirrors
  the `changed` notification shape, plus `payload` so it wires straight into a DB
  node).
- **Non-mutating:** no state change, no snapshot push.

## Consequences

- **Clean role split:** `ui-store` = hold state (write-in + `changed`-out);
  `ui-store-read` = read state on demand. No single-node fan-out bottleneck —
  multiple readers are just multiple node instances.
- **`ui-store` contract untouched** — no new op, no extra port, no migration.
- **Fits the reference model** (id + sub-path, ADR 0013) and the app-scoped
  reference-node pattern; `parent` is required and validated (P205).
- **New node = the four-file pattern** (js registration + html editor + schema +
  runtime handler) — build via the `/node-red-node` skill. New spec
  `docs/nodes/state/ui-store-read.md` + test catalogue.
- Verification is behavioural: with a per-client store edited via the UI, a read
  trigger must emit the CURRENT per-client slice (and honour the path override),
  measured on the node's output — not merely that the node registers.
