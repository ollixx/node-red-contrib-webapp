# Navigation & Dialogs

Multi-page apps: routes, the three navigate modes, dialogs with
`open`/`close`, and scoping a dialog to a route.

> Deutsch: [../de/guides/navigation-dialogs.md](../de/guides/navigation-dialogs.md)

## Goal

Build an app with several pages and a dialog: navigate between routes in
all three modes, open/close a dialog from the flow, and understand when to
scope a dialog to a route.

## Prerequisites

- [Getting started](../getting-started.md) and
  [Actions & Events](actions-events.md) (the wire-vs-reference idea returns
  here).

## Routes

A `ui-route` adds a page to the app under a path (`/about`,
`/items/:id`). Components mount into the route's slots exactly as they
mount into the app; the route's content replaces the app's `content` slot
while the route is active. Path segments starting with `:` are
**parameters** — inside the route, a **Route-Param** binding reads them
(e.g. bind a text to param `id` on `/items/:id`).

Routes emit `onEnter` and `onLeave` events on their output port — the
standard trigger for loading data when a page opens (see
[Displaying data](displaying-data.md)).

## Navigation: one action, three modes

Navigation is a `ui-action` with action type `navigate`. The **target
mode** decides where the destination comes from:

| Mode | Destination comes from | Use when |
|---|---|---|
| **wire** | the `ui-route` wired to the action's output — the route builds the location from its own path (plus params from the message) | the classic case: one button, one known page |
| **route** | a route picked by reference, plus a typed **params** list (each param a name + value, values can come from the message) | parameterised targets: "open item 42" |
| **url** | a `to` value (string, or dynamically from msg/flow/global/JSONata) holding the whole path | computed destinations, external-style URLs, "back to /" |

All three modes emit the routes' `onEnter`/`onLeave` events. A navigate
to a URL outside the app's routes leaves the app.

## Dialogs

A `ui-dialog` is an overlay with its own slots (`header`,
`header-actions`, `content`, `footer` — the `dialog` layout preset). It is
opened and closed with the action verbs **`open`** and **`close`**: wire a
`ui-action` (type `open` or `close`) to the dialog node, exactly like the
hide/show pattern in [Actions & Events](actions-events.md). The dialog
emits `onOpen`/`onClose` events on its output port.

**Route scoping:** a dialog optionally declares a **Parent Route**. If
set, the dialog can only be shown while that route is active — on any
other route it is not rendered at all (not even when its open state is
forced via URL). Without a parent route the dialog is available on every
page of the app. Scope a dialog to a route when it belongs to that page's
workflow (an edit dialog on a detail page); leave it unscoped for
app-wide dialogs (a global confirmation).

## Steps

1. Create an app with a home text and two routes: `/about` (a text and a
   back button) and `/items/:id` (a text bound to route param `id`, and a
   back button).
2. Add a "wired" navigation: button → `ui-action` (navigate, mode
   *wire*) → wire the action's output to the `/about` route. Deploy and
   click: the app switches to `/about`.
3. Add a "route mode" navigation: button → `ui-action` (navigate, mode
   *route*), pick the `/items/:id` route, and add the param `id` = `42`.
   Click: the app opens `/items/42` and the bound text shows `42`.
4. Add a "url mode" navigation: button → `ui-action` (navigate, mode
   *url*) with `to = /about`. The back buttons on both routes use the same
   mode with `to = /`.
5. Add a `ui-dialog` with a text in its `content` and a Close button in
   its `footer`. Wire: an "Open dialog" button → `ui-action` (`open`) →
   dialog, and the Close button → `ui-action` (`close`) → dialog. Deploy:
   the dialog opens and closes on click.

## Example flow

The finished result of the steps:
[`examples/guide/navigation-dialogs.json`](../../../examples/guide/navigation-dialogs.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/navigation-dialogs.json` (or paste its
   JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/navApp/` — try all three
   navigate buttons and the dialog.

## Where next

- [Auth](auth.md) — protecting routes and dialogs with `requiresGroup`.
- [Displaying data](displaying-data.md) — loading data on route enter.
