# ui-dialog

A dialog with its own layout — revealed with `open` / `close`, always modal.

> Deutsch: [de/nodes/ui-dialog.md](../de/nodes/ui-dialog.md)

## Purpose

`ui-dialog` defines a **dialog with its own layout** inside an app. It is a
disclosed element: it is revealed with the action verbs `open` / `close` (not
`show` / `hide`) and can optionally be dismissed by the user. Its content is
assembled from layout slots, like a route — view nodes mount via
`dialog:<id>/<slot>`. The server holds the authoritative open state and pushes
it to clients.

## When to use

- Show a confirmation, a form, or details in an overlay over the current page.
- Reveal it from a button via a `ui-action` with verb `open`; close via `close`
  or (if closable) the native X / ESC / overlay click.
- Scope a dialog to one route with **Parent Route** so it only appears there.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and pickers. | free text | `Dialog N` |
| **App** | The parent `ui-app`, from the app picker. Required. | app reference | — |
| **Titel** (`title`) | Visible dialog title (header). Omitted when `closable` is off (no header). | free text | empty |
| **Parent Layout** (`layout`) | Layout preset for the dialog. The `dialog` preset maps its slots onto the native dialog slots (`header` / `header-actions` / `content` / `footer`). | `vertical` / … / `dialog` | `vertical` |
| **Parent Route** (`route`) | Optional coupling to a `ui-route` of the same app: the dialog is then only renderable while that route is active. Empty = renderable in every route. | route reference | empty |
| **Modal** (`modal`) | **Dialogs are always modal today.** The active backend (`sl-dialog`) is natively modal, so `modal:false` behaves identically to `modal:true`. The field is a placeholder for a future non-modal mode — the docs promise no non-modal behaviour yet. | checkbox | `true` |
| **Schließbar** (`closable`) | The native close button / user dismissal. `true` shows the X and allows X / ESC / overlay close; `false` drops the whole header and the dialog is driven **only** by `open` / `close` actions. | checkbox | `true` |
| **Gruppen** (`requiresGroup`) | Comma-separated authz guard. Empty = auth only; set = the user needs one of the groups (server-enforced: the dialog is absent from the snapshot entirely otherwise). | group names | empty |
| **Events** | Which lifecycle events emit — each ticked event adds an output port. | `onOpen` / `onClose` | none |

## Inputs

`ui-dialog` is revealed through the action verbs **`open` / `close`** — send a
`msg.ui.action` with `type: "open"` / `"close"` whose target (or the wire)
addresses the dialog. `openDialog` / `closeDialog` are accepted as aliases.
Unknown / foreign messages — including verbs the dialog does not own — pass
through unchanged.

## Outputs / Events

One output port per ticked event:

| Event | Fires when | Key `msg.ui` fields |
|---|---|---|
| `onOpen` | the dialog is opened | `event`, `dialogId`, `clientId` |
| `onClose` | the dialog is closed (also via native X / ESC / overlay) | `event`, `dialogId`, `clientId` |

When the user closes the dialog, the server authoritatively sets
`ui.dialogs.<id>.open = false`, pushes a fresh snapshot and emits `onClose`.

## Examples

### 1. A button that opens a modal dialog

The home page shows a button; clicking it fires an `open` action wired to a
dialog whose content slot shows a confirmation line.

Flow file: [`examples/guide/ui-dialog.json`](../../../examples/guide/ui-dialog.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-dialog.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideDialog/` and click **Open
   dialog** — a modal dialog appears; close it with the X.

## Related

- [`ui-app`](ui-app.md) — the parent and routing context
- [Navigation & Dialogs](../guides/navigation-dialogs.md) — dialog open/close, route scoping
- [`ui-action`](ui-action.md) — the `open` / `close` verbs
- Contract doc (internal, German): `docs/nodes/structure/ui-dialog.md`
