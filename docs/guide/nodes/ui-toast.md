# ui-toast

A transient pop-up notification, fired from the flow, that dismisses itself.

> Deutsch: [de/nodes/ui-toast.md](../de/nodes/ui-toast.md)

## Purpose

`ui-toast` shows a **transient notification** that floats over the app and
closes itself after a configurable time. Unlike most view nodes it is not
mounted into a slot — it lives at **app level** and is triggered imperatively by
an incoming `msg.ui.toast` message. The content (text, severity, position,
duration) is taken from the message at runtime; the node's fields only supply
the defaults used when the message omits them.

It is **not** [`ui-log`](ui-log.md): `ui-log` is a persistent operator log fed by
the error channel; a toast is a short-lived end-user notice you fire explicitly.

## When to use

- Confirm an action to the user ("Saved", "Deleted") from the flow.
- Show a quick, self-dismissing status message that should not occupy layout
  space.
- For an **inline** notice that stays in the page, use [`ui-alert`](ui-alert.md)
  instead; for a persistent developer/operator log, use [`ui-log`](ui-log.md).

## Fields

The fields set the **defaults**; each is overridable per message.

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Toast N` |
| **App** (`app`) | The owning `ui-app` — toasts appear app-wide, not slot-bound. Required. | app picker | — |
| **Severity** (`severity`) | Default colour role when the message has no `severity`. | `primary`, `info`, `success`, `warning`, `danger`, `neutral` | `info` |
| **Duration (ms)** (`duration`) | Default auto-dismiss time. A positive `N` removes the toast after ~N ms; `0` or empty = no auto-dismiss (stays until the user closes it). | integer ≥ 0 | `4000` |
| **Position** (`position`) | Default on-screen corner. | `top-right`, `top-center`, `bottom-right`, `bottom-center` | `bottom-right` |
| **Visible** (`visible`) | Base field — declarative visibility (bindable boolean). | boolean binding | shown |

`Disabled`, `Color` and `Size` are N/A (a toast has no interactive state; its
colour comes from `severity`; it has no size steps).

## Inputs

`ui-toast` **has an input port**. It is triggered by a message carrying
`msg.ui.toast`:

| Field | Required | Meaning |
|---|---|---|
| `msg.ui.toast.message` | **yes** | the text shown |
| `msg.ui.toast.severity` | no | overrides the node default |
| `msg.ui.toast.position` | no | overrides the node default |
| `msg.ui.toast.duration` | no | overrides the node default (ms) |
| `msg.ui.clientId` | no | set → only that client sees it; absent → broadcast |

`msg.ui.toast.message` is the only required field. A message without it is
treated as not for this node and **passes through unchanged**; unrecognised /
foreign messages pass through too.

## Outputs / Events

`ui-toast` **has an output port**. Pass-through messages leave it unchanged. It
also emits a `dismiss` event when the user **manually** closes the toast — **not**
when it auto-dismisses after `duration`.

| Event | When | `msg.ui` fields |
|---|---|---|
| `dismiss` | user clicks the close button | `event: "dismiss"`, `appId`, `clientId`, `sourceId` |

## Examples

### 1. Fire a success toast from an inject

A `ui-toast` at app level, an inject node that sends
`msg.ui.toast = { message, severity }`, and a heading so the app root is never
empty. Deploy, open the app, then click the inject node in the editor to fire
the toast.

Flow file: [`examples/guide/ui-toast.json`](../../../examples/guide/ui-toast.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-toast.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideToast/`.
5. Click the **Send toast** inject node's button — a green "Saved successfully"
   toast appears bottom-right and dismisses itself.

## Related

- [`ui-alert`](ui-alert.md) — an inline, in-page notice bar
- [`ui-log`](ui-log.md) — a persistent operator log (the counterpart)
- Contract doc (internal, German): `docs/nodes/feedback/ui-toast.md`
