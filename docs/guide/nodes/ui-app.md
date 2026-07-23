# ui-app

The root of a declarative web app — its base URL, layout, theme, auth and
lifecycle events.

> Deutsch: [de/nodes/ui-app.md](../de/nodes/ui-app.md)

## Purpose

`ui-app` is the **root** of a web app. It defines the base URL, the base
layout, the theme (design tokens), logging behaviour, authentication and the
app's lifecycle events. It is also the **implicit root route `/`**: home-page
content mounts straight into the app's layout slots, so a simple app needs no
`ui-route` node at all. The app is served at `/webapp/<root>`.

## When to use

- Always — every declarative web app starts with exactly one `ui-app`.
- Put home-page content directly in the app's slots (no `ui-route` for `/`).
- Add one `ui-app` per app; several apps can live in one Node-RED instance,
  each with its own unique `root`.

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor; also the browser-tab title and the app-bar title when the header slot is empty. | free text | `App N` |
| **Root** | The URL segment after the fixed `/webapp/` prefix — the app is reachable at `/webapp/<root>`. Unique across all apps; URL-path characters only. A live preview shows the resulting URL. Required. | url segment | — |
| **Layout** | Base layout preset; determines the available slots and the child-placement fields of direct children. | `vertical` / `horizontal` / `app` / `grid` / `absolute` | `vertical` |
| **Styles anpassen** (`tokens`) | App-wide design tokens (colours, typography, spacing, radii) opened via a dialog. Unset tokens fall back to system defaults; the theme is additive and inherited by every rendered component. | token map | system defaults |
| **Logging** (`forwardErrorsToClient` / `forwardErrorMinSeverity`) | Opt-in forwarding of **framework errors** to connected clients, from the chosen severity up. Forwarded messages are redacted. Off is the safe default. | `aus` / `debug` / `info` / `warn` / `error` | `aus` (off) |
| **Auth** (`auth`) | Authentication mode. `none` leaves the app open; `trusted-header` enforces identity on every app endpoint (from reverse-proxy headers) and exposes it as the `user` binding source. The header/redirect detail rows appear for `trusted-header`. | `none` / `trusted-header` (+ header names, redirect) | `none` |
| **Media Store URL** (`mediaStoreUrl`) | Base URL of a media store; when set, images can be referenced as `asset:<id>` (resolved through an app-scoped backend proxy, never directly by the client). | URL | empty |
| **Events** | Which lifecycle events emit — each ticked event adds an output port. | `clientConnected` / `clientDisconnected` / `onEnter` / `onLeave` | none |
| **Status** (`deployMode`) | How a deploy reaches connected clients. `Entwicklung` (development) auto-delivers the freshly compiled model; `Produktion` shows a version alert and waits for the user's manual reload. | `Entwicklung` / `Produktion` | `Entwicklung` |

## Inputs

`ui-app` has an input port so the app-global verbs `navigate` and `reset` can
be wired (or picked) to it like any other target — a `navigate` wired to the
app navigates to the root `/`. It consumes **no business messages**: unknown or
foreign messages are **passed through unchanged**. Framework errors (e.g. a
failed snapshot build) are reported as structured errors, not treated as input.

## Outputs / Events

One output port per ticked event, in list order:

| Event | Fires when | Key `msg.ui` fields |
|---|---|---|
| `clientConnected` | a client opens the app (new session) | `event`, `clientId` |
| `clientDisconnected` | a client closes / drops the connection | `event`, `clientId` |
| `onEnter` | the implicit root route `/` is entered | `event`, `route`, `params`, `clientId` |
| `onLeave` | the root route `/` is left | `event`, `route`, `params`, `clientId` |

Use `clientConnected` / `onEnter` to load initial data — target the new client
with `msg.ui.clientId` rather than broadcasting.

## Examples

### 1. Minimal app with a home page

An `app`-layout app with a header and one content line — the app-bar shows the
app name, the content slot shows a greeting.

Flow file: [`examples/guide/ui-app.json`](../../../examples/guide/ui-app.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-app.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideApp/` — you see the app bar
   and "Welcome to the app".

## Related

- [Getting started](../getting-started.md) — your first app end to end
- [Layout & Slots](../guides/layout-slots.md) — presets and mount paths
- [Theming & Components](../guides/theming-components.md) — design tokens
- [Auth](../guides/auth.md) — trusted-header operation and the `user` binding
- [`ui-route`](ui-route.md) — sub-pages
- Contract doc (internal, German): `docs/nodes/structure/ui-app.md`
