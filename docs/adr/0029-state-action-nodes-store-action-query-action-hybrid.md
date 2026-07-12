# ADR 0029: state-action nodes — `ui-store-action` + `ui-query-action`, hybrid wire/reference

- Status: accepted
- Date: 2026-07-12
- Builds on: [ADR 0011](0011-ui-action-navigation-target-modes-and-dual-path-coding.md)
  (the hybrid **target-mode** principle — *„Ein wiring muss immer auch ein Weg
  sein"*, references-only was rejected), [ADR 0028](0028-store-reads-are-a-separate-reference-node.md)
  (`ui-store-read`, the reference-based reader), and [ADR 0013](0013-store-binding-subpath.md)
  (store = node id + one-level sub-path).

## Context

Triggering state operations — `query.refresh`, `store.reset`/`set`/`patch`/… —
today needs hand-written function nodes that build `msg.ui.query = {queryPath,
refresh:true}` / `msg.ui.store = {id, op, …}`. That is boilerplate, error-prone
(exact field names/shape), and undiscoverable. `ui-action` covers only UI verbs
(navigate/show/hide/enable/disable/trigger), not store/query state ops.

Owner (2026-07-12): *„ich vermisse gerade action knoten für store und query …
einen knoten ‚store-action', der alle actions bietet zum Store. und einen
‚query-action'."* On the wire-vs-reference question the owner chose the
established hybrid: *„Bislang waren wir hybrid unterwegs, also beides anbieten."*

## Decision

Two typed, reference-based **state-action nodes**, each with a **`mode`** selector
(`reference | wire`) that mirrors `ui-action.targetMode`:

- **`ui-store-action`** — references a `ui-store`; op selector
  `set | patch | delete | replace | reset`. (Reading stays `ui-store-read`, ADR
  0028 — a getter, not an action.)
- **`ui-query-action`** — references a `ui-query`; action selector `refresh`
  (extensible).

**The two modes (per node, always both available):**
- **`reference`** — apply the op **directly, server-side**, to the referenced node.
  `ui-store-action` runs the store operation (per-client via `msg.ui.clientId`,
  same scope rule as writing); `ui-query-action` calls the query's refresh
  (`fireQueryRefresh`) so its out-port fires the retrieval. **No wire** to the
  target needed.
- **`wire`** — **emit** the built envelope on the node's out-port
  (`msg.ui.store = {id, op, path, value}` / `msg.ui.query = {queryPath, refresh:true,
  params}`); the flow author wires it to the `ui-store`/`ui-query` node (which
  applies it) or to a dispatcher. Keeps the wire path a first-class way.

**Common contract:**
- Value (store) / params (query) come from `msg.payload` (+ optional config).
  `reset` takes no value.
- Store `path` override precedence — `msg.ui.store.path` › `msg.path` › config —
  exactly as `ui-store-read`.
- `parent` (owning app) required and validated (P205); app-scoped reference node.

## Consequences

- **No boilerplate, discoverable, typed.** Pick the store/query + the op in the
  editor instead of hand-building `msg.ui.*`.
- **Hybrid honoured (owner principle):** the wire path stays a full way (`wire`
  mode); the reference path removes wiring and the fan-out bottleneck (`reference`
  mode). Neither is forced.
- **The state family becomes symmetric:** `ui-store` (hold + write-via-input +
  changed-stream) · `ui-store-read` (read by ref) · `ui-store-action` (mutate) ·
  `ui-query` (data + trigger-via-input) · `ui-query-action` (trigger by ref). The
  input-message protocol of `ui-store`/`ui-query` stays valid — `wire` mode uses it.
- **Two new nodes, four-file pattern** (js + html + schema + runtime), via the
  `/node-red-node` skill; new specs under `docs/nodes/state/` + test catalogues.
- Verification is behavioural: in `reference` mode a triggered action must mutate
  the store slice / fire the query retrieval (measured on the effect), and in
  `wire` mode the emitted envelope must carry the correct `id/op/path/value` (resp.
  `queryPath/refresh`) — not merely that the node registers.
