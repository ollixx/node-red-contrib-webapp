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
