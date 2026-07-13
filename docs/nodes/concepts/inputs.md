# Input ports — pushing state to view nodes

Every view/input node has an input port so a Node-RED flow can push state
updates directly to that node without going through `ui-store`.

## msg.payload — update the primary field

Send any message with a non-null `msg.payload` to update the node's primary
mutable field and immediately push a fresh SSE snapshot to all connected
clients of the parent app.

| Node | Primary field updated |
|---|---|
| `ui-text` | `value` (displayed text) |
| `ui-button` | `label` |
| `ui-badge` | `value` |
| `ui-checkbox` | `value` (checked state) |
| `ui-switch` | `value` |
| `ui-radio` | `value` (selected option) |
| `ui-select` | `value` (selected option) |
| `ui-input` | `value` |
| `ui-textarea` | `value` |
| `ui-slider` | `value` |
| `ui-datepicker` | `value` |
| `ui-progress` | `value` |
| `ui-image` | `src` |
| `ui-avatar` | `src` |
| `ui-alert` | `message` |
| `ui-table` | `rows` |
| `ui-list` | `items` |

Example — update a text label from an inject node:

```json
{ "payload": "Hello updated" }
```

## Message mode (`msg`) — drives EVERY msg-bound field

The value typedInput offers a **`msg`** ("Message mode") type on **every** field,
including the base fields **`visible`** and **`disabled`**. Message mode is not
limited to the primary field: when a message arrives, **each** field whose saved
binding is `msg` is updated from its **own** configured message property, and a
fresh snapshot is pushed (ADR 0036).

- `ui-alert.visible = msg.show` → sending `msg.show = true` shows the alert,
  `msg.show = false` hides it (the element is added/removed, not just styled).
- `ui-input.disabled = msg.locked` → `msg.locked = true` disables the field.
- Any number of fields on one node can be `msg`-bound at once; each reads its own
  path (e.g. `message` from `msg.text`, `visible` from `msg.show`).

`visible`/`disabled` are **boolean** fields: the incoming value is coerced to a
boolean, so `true`/`false` and the strings `"true"`/`"false"` all work.

A **JSONata**-bound field behaves the same way — the expression is evaluated
against the incoming `msg` and the result drives the field (boolean-coerced for
`visible`/`disabled`).

Back-compat: when a node's **primary** field is *not* explicitly `msg`-bound, a
bare `msg.payload` still updates it (the table above).

## msg.ui.patch — update arbitrary fields

Send `msg.ui.patch` as an object to override any combination of fields on
the node's definition. All fields in the patch are merged into the
in-memory definition and a snapshot is pushed immediately.

Example — update an alert's message and severity:

```json
{
  "ui": {
    "patch": {
      "message": { "kind": "literal", "value": "Disk almost full" },
      "severity": "warning"
    }
  }
}
```

Binding-typed fields (`value`, `src`, `message`, `rows`, `items`) must be
supplied as binding objects (`{ "kind": "literal", "value": ... }`) when
using `msg.ui.patch`. For simple literal values, prefer `msg.payload`.

## Component operations

`msg.ui.component.op` messages (`show`, `hide`, `enable`, `disable`, `focus`,
`reset`) continue to work as before and are not affected by this feature.

## Snapshot push behaviour

The snapshot is broadcast to **all** connected clients of the app (no
per-client targeting for payload/patch updates). The in-memory update is
ephemeral — it persists only until the next Node-RED deploy, at which point
the node config is re-read from the flow file.
