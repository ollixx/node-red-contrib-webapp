# ADR 0033: a consumed `msg.ui.<command>` envelope is deleted after successful processing

- Status: accepted
- Date: 2026-07-13
- Relates to: [ADR 0028](0028-store-reads-are-a-separate-reference-node.md) /
  [ADR 0029](0029-state-action-nodes-store-action-query-action-hybrid.md) (the
  state-action nodes that emit/consume the `msg.ui.store` / `msg.ui.query`
  command envelopes), and [ADR 0006](0006-error-handling-and-logging.md) (the
  `msg.ui`-carried structured error).

## Context

A message travelling through the flow carries **command envelopes** under
`msg.ui.*`: `msg.ui.store = {id, op, path, value}`, `msg.ui.query = {queryPath,
refresh|data|error, params}`, `msg.ui.dialog = {…}`. A node's input handler reads
its envelope and applies it (writes the store slice, folds the query data, opens a
dialog). **Today the handler leaves the envelope on the message** and forwards the
message unchanged on its out-port.

That pollutes the message: a **downstream** node that also processes `msg.ui.<key>`
re-applies the **same** command, and the envelope accumulates stale data across
hops. Owner-reported (2026-07-13, dev app "Entity Editor"):

- Flow: `link in "query refresh"` → **ui-query-action** (`action=refresh`,
  `mode=wire`) → **ui-query "Query 1"** → out → `link "query out"`; a second
  `link in "query raw"` → **ui-query-action** (`action=replace`) → the same
  ui-query.
- The refresh action emits `msg.ui.query = {queryPath, refresh:true, params}`
  while **spreading `...msg`** — so `msg.payload` (the incidental trigger payload)
  and the query envelope both ride forward. `ui-query` applies the refresh
  (lifecycle → loading) and then `send(msg)` forwards the message **with
  `msg.ui.query` and `msg.payload` intact**. Downstream, the stale `msg.payload`
  is then re-consumed as query DATA (a `replace`), so "refresh" ends up replacing
  the query value with a stale payload — *"das darf natürlich NICHT passieren"*.

Owner decision (2026-07-13): the fix is not to change the refresh contract
(`msg.payload` may still feed `params`); it is that **a consumed command envelope
must be removed from `msg.ui` after successful processing**, so it cannot be
double-processed and the message object stays clean.

## Decision

**A node that successfully consumes a `msg.ui.<command>` envelope deletes exactly
that sub-key from the message before forwarding it.**

- Scope = the **command envelopes** a node applies: `msg.ui.store` (ui-store
  set-via-input; ui-store-action / ui-store-read path-override consumption),
  `msg.ui.query` (ui-query data/error/refresh apply; ui-query-action after it has
  read `params`/paging from it), `msg.ui.dialog` (ui-dialog open/close). Each
  consuming handler `delete msg.ui.<key>` (or rebuilds `msg.ui` without it) once
  its processing succeeds.
- **Delete only the consumed sub-key, never the whole `msg.ui`.** Context keys
  that are *not* commands stay: **`msg.ui.clientId`** (per-client targeting, read
  by many later hops) and the outgoing **`msg.ui.event`** (a component event, not
  an input command) are preserved.
- **"Successful processing" is per handler:** a terminal apply (store write, query
  `data`/`error` fold, dialog op) deletes the key after the state write. For a
  **forwarded trigger** (ui-query `refresh` pass-through, which re-emits to drive
  the wired fetch), the node forwards a **clean** trigger — the fetch still
  receives what it needs (`queryPath`, `refresh`, `params`) via a freshly built
  envelope, but the **incoming** message's stale `msg.ui.query` (and any leftover
  command state) is not carried verbatim into a re-processable position.
- On a failure path the envelope is **not** deleted (so the error is diagnosable
  and a retry still carries the command).

## Consequences

- **No double-processing.** A command applied by one node cannot be silently
  re-applied by another downstream node; the owner's refresh→replace bug is fixed
  as a direct consequence (Point 2 folds into this).
- **`msg.ui` stays a clean, single-purpose channel** — after a hop it carries only
  context (`clientId`) and any *new* command a node deliberately emits, never a
  spent one.
- **Uniform rule, small per-handler change.** Each input handler in `webapp.js`
  (`queryInputHandler`, `queryActionInputHandler`, the ui-store set-via-input path,
  `storeActionInputHandler`, `storeReadInputHandler`, `dialogInputHandler`) gains a
  `delete msg.ui.<key>` after its successful apply; wire-mode emitters that
  *produce* an envelope are unchanged (they are not the consumer).
- **Testable invariant:** after a consuming node, the out-port message must not
  carry the consumed `msg.ui.<key>`; a two-consumer chain must apply the command
  exactly once. This becomes the acceptance test (incl. the refresh→replace repro).
- Docs: `docs/nodes/concepts/events.md` / the state-node specs gain a short
  "envelope lifecycle: consumed = removed" note.
