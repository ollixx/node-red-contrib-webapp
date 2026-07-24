# ui-image

Renders an image from a bindable source — a URL, a managed asset, or a pushed buffer.

> Deutsch: [de/nodes/ui-image.md](../de/nodes/ui-image.md)

## Purpose

`ui-image` renders an **image** at a mount point. The source (`src`) is bindable,
so it can be a static URL, a value from state/query/route-param, a managed
**asset** from the app's media store, or a buffer pushed in on a message. Alt
text, a fallback URL for load errors, and width/height/fit control accessibility
and presentation.

## When to use

- Show a logo, avatar-like picture, product photo, or any image.
- Bind the source to data (a `state`/`query` field holding a URL).
- Serve an uploaded/managed image through the app's media proxy (`asset:` source).
- Push an image buffer from a flow (HTTP request, file read) into the UI.

## The `src` source model

`src` uses the canonical value-binding set **plus** an `asset` type:

- **URL** (`literal`) — a static or dynamically bound image URL. `state`,
  `query`, `routeParam`, `store`, `reactive`, `msg`, `flow`, `global`, `jsonata`,
  `env` all resolve to a URL string.
- **Asset** — a **managed medium** from the app's media store (configured in
  `ui-app.mediaStoreUrl`). The Asset type opens the media picker (browse/upload)
  and stores the choice as a `literal` `asset:<id>`; at runtime it is resolved
  through the app's **backend proxy**, so the real store URL stays hidden.
- **msg** (wiring-first) — `msg.payload` sets the source: a **string** (URL,
  `asset:<id>`, or a ready `data:` URL) is taken as-is; a **Buffer** is converted
  to a `data:` URL (content type from `msg.contentType`/`msg.headers` or the magic
  bytes). Caveat: a `data:`/base64 source lands in the snapshot and is re-sent on
  every render — fine for small/rare images, use URL/asset for large/frequent ones.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Image N` |
| **Parent Slot** (`mount`) | The slot this image mounts into. Required. | mount path | — |
| **Src** (`src`) | The image source. Required. | URL binding, `asset`, `msg`, … (see above) | empty literal |
| **Alt Text** (`alt`) | Accessibility alt text (bindable). Leave empty for purely decorative images. | binding | empty |
| **Fallback URL** (`fallbackSrc`) | Shown if `src` fails to load (bindable). | binding | empty |
| **Width** (`width`) | Component width — integer px or CSS string (`100%`, `12rem`). | number / CSS | parent layout |
| **Height** (`height`) | Component height — integer px or CSS string. | number / CSS | natural ratio |
| **Fit** (`fit`) | object-fit mode. | `contain`, `cover`, `fill`, `none`, or browser default | browser default |
| **Visible** (`visible`) | Render gate (bindable). | binding | shown |
| **Order / Row / Col / spans / X·Y** | Placement in the parent slot. | numbers | canvas-y |

`Disabled`, `Color` and `Size` are N/A (an image has no interactive state, no
colour, and no size steps).

## Inputs

`ui-image` **has an input port**:

- **`msg.payload`** (non-`null`) sets `src` (string as-is; Buffer → `data:` URL)
  and pushes a snapshot to all clients.
- **`msg.ui.patch`** overrides fields (`src`, `alt`, `fit`, `width`, `height`);
  binding fields (`src`) as a binding object.
- **Component-state ops** (`msg.ui.component.op`): `show` / `hide`.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

None — `ui-image` has no output port and emits no events.

## Examples

### 1. A static image with alt and fallback

An image with a bound `src`, alt text, a fallback URL, and `fit = contain`.

Flow file: [`examples/guide/ui-image.json`](../../../examples/guide/ui-image.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-image.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideImage/` — the image renders at
   the configured size.

## Related

- [Bindings & State](../guides/bindings-state.md) — the binding kinds
- `ui-icon` — a vector icon (not a raster image); `ui-avatar` — a person picture
- Contract doc (internal, German): `docs/nodes/display/ui-image.md`
