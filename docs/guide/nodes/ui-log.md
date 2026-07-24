# ui-log

A persistent, filterable panel showing the app's structured error/log stream.

> Deutsch: [de/nodes/ui-log.md](../de/nodes/ui-log.md)

## Purpose

`ui-log` shows the app's **structured error and log stream** as a persistent,
inspectable list in the app interface. It automatically subscribes to the app's
SSE `error` channel and updates live as new entries arrive. Entries accumulate in
a FIFO ring buffer; the oldest are dropped once `maxEntries` is exceeded.

It is **not** [`ui-toast`](ui-toast.md): a toast is a transient end-user
notification; `ui-log` is a persistent operator/developer tool.

> **Prerequisite (important).** The log panel stays **permanently empty** unless
> its parent `ui-app` has **`forwardErrorsToClient: true`** (optionally with
> `forwardErrorMinSeverity`). Without that app setting the server forwards no
> errors over the SSE channel and there is nothing for `ui-log` to show. Enable
> it on the `ui-app` node first.

## When to use

- Give operators/developers an in-app view of framework errors and log entries.
- Filter what is shown by severity (`minSeverity`).
- For a transient, self-dismissing user notification instead, use
  [`ui-toast`](ui-toast.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Log N` |
| **Parent Slot** (`mount`) | The slot this mounts into. Required. | mount path | — |
| **Min Severity** (`minSeverity`) | Lowest severity shown; entries below are ignored. | `debug` (all), `info`, `warn`, `error` (only) | `debug` |
| **Max Entries** (`maxEntries`) | Ring-buffer size; oldest entry dropped past the limit. | integer ≥ 1 | `50` |
| **Start collapsed** (`collapsed`) | Start the panel collapsed (user can expand). | checkbox | off |
| **Visible** (`visible`) | Base field — declarative visibility (bindable boolean). | boolean binding | shown |

`Disabled`, `Color` and `Size` are N/A (a log has no interactive state, renders
no colour of its own, and has no size steps). There is no `variant`/`severity` —
individual entries are styled by their own severity.

## Entry format

Each SSE entry follows the structured error shape (ADR 0006): `severity`, `code`,
`message`, `context` (`appId`/`nodeId`/`op`), `timestamp` (ISO 8601) and `origin`
(`client`/`server`). New entries are inserted at the **top** (newest first).

## Inputs

`ui-log` has **no input port**. It receives data only through the parent app's
SSE `error` channel — there is no flow wiring. (See the prerequisite above.)

## Outputs / Events

None — `ui-log` has no output port and emits no events.

## Examples

### 1. A log panel with error forwarding enabled

An app with `forwardErrorsToClient` enabled and a `ui-log` panel; a heading keeps
the root non-empty while no errors have arrived yet. Trigger a framework error in
the app to see it appear in the panel.

Flow file: [`examples/guide/ui-log.json`](../../../examples/guide/ui-log.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-log.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideLog/` — the log panel is present
   (empty until an error is forwarded).

## Related

- [`ui-toast`](ui-toast.md) — a transient user notification (the counterpart)
- [`ui-app`](ui-app.md) — where `forwardErrorsToClient` lives
- Contract doc (internal, German): `docs/nodes/feedback/ui-log.md`
