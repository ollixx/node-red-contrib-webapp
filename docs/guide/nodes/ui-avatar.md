# ui-avatar

Shows a user picture, or falls back to initials, then a generic icon.

> Deutsch: [de/nodes/ui-avatar.md](../de/nodes/ui-avatar.md)

## Purpose

`ui-avatar` shows a **user picture** or — as a fallback — **initials**, and if
neither resolves, a generic user icon. Both the image source and the initials are
bindable, so the avatar can follow the current user or a row's data. It is purely
presentational and emits no events.

## When to use

- Show the signed-in user's picture (bind `image` to a `user`/store value).
- Render initials when no picture is available (a contact list, a comment author).
- Give each row of a `ui-repeat` its own avatar from item data.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Avatar N` |
| **Parent Slot** (`mount`) | The slot this avatar mounts into. Required. | mount path | — |
| **Image** (`src`) | The avatar image source (bindable). | `URL` (literal), `Asset` (managed medium, if `ui-app.mediaStoreUrl` is set), `store`, and every other binding kind | empty |
| **Fallback Initials** (`initials`) | Initials shown when no image resolves (bindable, e.g. `JD`). | canonical value binding | empty |
| **Fallback Icon** (`icon`) | Backend-neutral icon shown when neither image nor initials resolve. | `library:name` (bindable) | empty (generic icon) |
| **Size** (`size`) | Avatar size. | `xs`, `sm`, `md`, `lg`, `xl` | `md` |
| **Shape** (`shape`) | Avatar shape. | `circle`, `square` | `circle` |
| **Variant** (`variant`) | Semantic colour role. Note: `sl-avatar` has no native variant — emitted as `data-variant` (a Bootstrap adapter or your CSS reads it). | none, `primary`, `neutral`, `success`, `info`, `warning`, `danger` | none |
| **Visible / Color** | Base fields (bindable). | binding / value | shown / theme |
| **Order / Row / Col / spans / X·Y** | Placement in the parent slot. | numbers | canvas-y |

`Disabled` is N/A (an avatar has no interactive state).

## The fallback order

1. `image` is set and loads → show the image.
2. `image` missing or fails → show `initials` (if set).
3. No initials → show the `icon` fallback (if set), else the backend's generic
   user icon.

## Inputs

`ui-avatar` **has an input port**:

- **`msg.payload`** (non-`null`) overrides `src` (the primary image URL) and
  pushes a snapshot to all clients.
- **`msg.ui.component.op`** (`show` / `hide`) — shows/hides the avatar.
- **`msg.ui.patch`** — overrides fields (binding fields as a binding object).
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

None — `ui-avatar` has no output port and emits no events.

## Examples

### 1. An initials avatar

An avatar with no image, showing initials `AD` as a circle at size `lg` with the
`primary` variant; a fallback icon covers the no-initials case.

Flow file: [`examples/guide/ui-avatar.json`](../../../examples/guide/ui-avatar.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-avatar.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideAvatar/` — the avatar shows the
   initials.

## Related

- [`ui-image`](ui-image.md) — a plain image; [`ui-icon`](ui-icon.md) — a vector icon
- [Bindings & State](../guides/bindings-state.md) — the `user` binding, stores
- Contract doc (internal, German): `docs/nodes/display/ui-avatar.md`
