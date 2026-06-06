# ADR 0006: Error handling and logging

- Status: accepted
- Date: 2026-06-06
- Scope: cross-cutting. Establishes the structured error/log contract that the
  client logging (P55), the backend→frontend error transport (P56), and the
  `ui-log` display node (P57) all consume. This ADR is the **foundation**: it
  fixes the taxonomy, the wire shape, and the policies. The phases above wire it.

## Context

The node-review (2026-06-06) found that error handling was not merely missing —
the implementation did the **opposite** of what is wanted:

- **Client** (`resources/lib/webapp-client.js`): every `catch` block silently
  swallows the failure ("ignore a malformed frame", "nothing to apply", the empty
  `.catch` on the `/event` POST). There is **no** `console.*` logging anywhere. If
  a snapshot frame is malformed, an event POST fails, or a command targets a
  missing node, nothing surfaces — not in the UI, not in the console.
- **Runtime** (`nodes/webapp.js`): a handful of bare `node.error` calls with no
  context; most failure paths are silent. There is no structured error model and
  no shared shape, so two failures of the same kind log differently (or not at
  all).
- There is **no transport** carrying a backend failure to the browser, no
  surfacing of the log inside the app, and no log node.

The owner's requirement:

1. Everything that goes wrong is logged **meaningfully** — with context, not just
   an exception code.
2. The client logs to the console **by default**, human-readably — never silent
   swallowing.
3. Backend errors are forwarded to the frontend **configurably** and logged there.
4. A log-display node (`ui-log`) shows the log as a configurable UI element.

### Boundary — whose errors

This contract covers errors **the framework owns**:

- **Client runtime** — `fetch`/hydrate failures, render failures, malformed SSE
  frames, an `/event` POST that fails, a command targeting a node that is not
  rendered.
- **Webapp runtime** (`nodes/webapp.js`) — `mapConfig` / schema validation,
  `ui-store` operations, `ui-action` command building, snapshot assembly, SSE
  write failures.

It explicitly does **not** swallow the flow author's own logic errors. A failure
inside a user `function` / `db` / `http` node stays in the **flow's** domain and is
handled with ordinary Node-RED `catch` nodes — consistent with
`docs/nodes/concepts/events.md` ("Der Flow ist der einzige Ort für Logik."). The
forwarding config (decision 4) is the **opt-in bridge** that lets a flow author
surface *framework* errors into the app; it is not a general flow-error pipeline.

## Decision

### 1. One structured error/log shape

A single shape is the source of truth for the client, the runtime, and the log
node. It is exported from `packages/schema` (decision 6) so all three import the
same definition rather than re-declaring it.

```
{
  severity:  "debug" | "info" | "warn" | "error",
  code:      string,        // stable, machine-greppable, e.g. "client.snapshot.malformed"
  message:   string,        // human-readable, WITH context inline
  context: {
    appId?:  string,
    nodeId?: string,
    op?:     string         // the operation that failed, e.g. "applyCommand", "mapConfig"
  },
  timestamp: string,        // ISO 8601 (new Date().toISOString())
  origin:    "client" | "server"
}
```

- `severity` is the **only** enum that maps to a console method (decision 3) and
  the forwarding threshold (decision 4). It is deliberately the standard four
  levels, no more.
- `code` is a stable dotted identifier (`<origin>.<area>.<reason>`) so failures
  are greppable across client and server logs and across releases. It is NOT
  shown to end users; it is for developers.
- `message` is the human-readable line and **already contains the relevant
  context** (ids, the op, the underlying error text). `context` carries the same
  facts structurally for the log node and for filtering. Both are populated — the
  message is not derived from `context` at log time, to keep the call site free to
  phrase the failure well.
- `context` fields are all optional: a pure client-render failure may have no
  `nodeId`; a connection-lifecycle log may have only `appId`.
- `origin` records which side produced the entry, so a forwarded server error is
  still recognisable as `origin: "server"` once it is logged in the browser.

#### Human-readable messages — catalog vs inline

**Decision: inline at the call site, not a central catalog.** Each log/throw site
writes its own message string, interpolating the context it has. A central message
catalog (id → template) was considered and rejected for now: the failure set is
small and spread across two languages of call site (the JS thin client and
`webapp.js`), a catalog would add an indirection that obscures *where* a message
comes from, and the `code` field already gives the stable machine handle a catalog
would otherwise provide. If message reuse or i18n becomes a real need later, a
catalog keyed by `code` is the natural extension and does not change the wire shape.

### 2. Client logging policy — log, never swallow

The thin client logs by default. No `catch` may be silent.

- Every former silent `catch` logs at `warn` or `error` (per how recoverable the
  failure is) **and still degrades gracefully** — log AND degrade, never re-throw
  into the user's page.
- **Message tracing at `debug`** (the owner's explicit wish): every incoming and
  outgoing message is logged at `debug`.
  - **Outgoing**: each `/event` POST (event name + params + `appId`) and the
    hydrate fetch.
  - **Incoming**: each SSE frame — `snapshot` / `command` / `toast` / `error` —
    as a compact summary (event type + key ids), **not** a full payload dump.
- **Lifecycle at `info`**: `EventSource` open (connected), error/close
  (disconnected), and auto-reconnect.

`debug` is used for the high-volume tracing precisely because it maps to
`console.debug` (decision 3), which DevTools hides behind the "Verbose" level — so
tracing is always available and filterable but never floods the default console.

### 3. severity → console method

The shared client logger maps severity to the matching console method, one-to-one:

| severity | console method  | typical use                                   |
|----------|-----------------|-----------------------------------------------|
| `debug`  | `console.debug` | message tracing (in/out), verbose diagnostics |
| `info`   | `console.info`  | connection lifecycle                          |
| `warn`   | `console.warn`  | recoverable failure (frame dropped, retry)    |
| `error`  | `console.error` | unrecoverable failure (hydrate failed)        |

The logger prints `message` plus a readable rendering of `context` (and `code`),
not a raw object dump.

### 4. Backend → frontend forwarding — opt-in, gated, redacted

Server-side framework errors can be forwarded to connected clients over a **new
SSE `error` event** on the existing `GET /webapp/:appId/stream` channel (the same
transport as `snapshot` / `command` / `toast`, per ADR 0003). The forwarded
payload is the shape from decision 1 with `origin: "server"`.

Forwarding is **off by default** and configured per `ui-app`:

- `forwardErrorsToClient` (boolean, default **false**).
- `minSeverity` (one of the severity enum, default `error`) — only entries at or
  above the threshold are forwarded.
- **Redaction**: the forwarded `message` is sanitised so server internals (stack
  traces, file paths, raw exception dumps) are not leaked to anonymous app
  visitors; `code` + a cleaned human message are sent. `context` carries only the
  framework ids (`appId` / `nodeId` / `op`), never arbitrary payload.

**Security rationale.** The deployed `/webapp/:appId/*` routes are anonymous
`httpNode` endpoints. Forwarding raw server errors to every connected browser
would leak internal structure and aid an attacker. Default-off + an explicit
severity threshold + redaction make the bridge a deliberate, scoped opt-in rather
than a silent leak. Per-client targeting reuses the P15 `clientId` addressing the
SSE channel already supports.

### 5. The log node — `ui-log`

**Name decision: `ui-log`** (over `ui-error` / `ui-debug`). The node displays the
whole error/log **stream** at any severity — not only errors and not only debug —
so the neutral name is the honest one. It is a normal view node: it mounts into a
slot, takes a `parent`, and renders the structured entries (decision 1) as a
readable list/console element, updating live as new entries arrive over the SSE
`error` channel (decision 4).

**`ui-log` vs `ui-toast`.** They are not duplicates:

- `ui-toast` — a **transient user notification**. It pops, it auto-dismisses, it is
  aimed at the end user ("Saved.", "Connection lost.").
- `ui-log` — a **persistent, inspectable log**. Entries accumulate, are filterable
  by severity, and are aimed at a developer/operator looking at the running app.

A failure may legitimately produce both (a toast for the user, a log entry for the
operator), but neither replaces the other.

### 6. Schema contract (this phase's only code)

`packages/schema/src/contracts.ts` gains the shape from decision 1 as exported
Zod schemas + inferred TypeScript types — the single source of truth consumed by
the client logger (P55), the runtime forwarder (P56), and the `ui-log` node (P57):

- `errorSeveritySchema` — the `debug | info | warn | error` enum.
- `errorOriginSchema` — the `client | server` enum.
- `errorContextSchema` — `{ appId?, nodeId?, op? }`.
- `structuredErrorSchema` — the full object, with `timestamp` validated as a
  non-empty ISO-like string.

**No wiring in this phase.** P54 adds the contract only; behaviour is unchanged and
the existing E2E suite stays green. P55–P57 consume the contract.

## Consequences

- A single shape spans client and server; a forwarded server error is logged in
  the browser with its original `origin`, `code`, and `severity`.
- The thin client becomes observable: no silent `catch`, full message tracing at
  `debug`, lifecycle at `info`. (P55.)
- The runtime logs failures with context and can opt-in forward them — gated and
  redacted — over a new SSE `error` event. (P56.)
- The log is visible **inside the app** via `ui-log`, distinct from `ui-toast`.
  (P57.)
- The forwarding default is **off**: an app must deliberately enable it, so the
  secure posture is the zero-config one.
- Messages are authored inline; if i18n/reuse later forces a catalog it keys off
  the existing `code` field without changing the wire shape.
