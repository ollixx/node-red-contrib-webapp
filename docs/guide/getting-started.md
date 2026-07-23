# Getting started

Install the package and build your first web app — a welcome page with a
button that navigates to a second page — in under ten minutes.

> Deutsch: [de/getting-started.md](de/getting-started.md)

## Prerequisites

- A running [Node-RED](https://nodered.org/docs/getting-started/) instance
  (version 4.x recommended).
- Basic familiarity with the Node-RED editor (adding nodes, Deploy).

## Install

**Via the palette manager (recommended):** in the Node-RED editor open the
menu (☰) → **Manage palette** → **Install**, search for
`node-red-contrib-webapp`, and click **Install**.

**Via npm:** in your Node-RED user directory (usually `~/.node-red`):

```bash
npm install node-red-contrib-webapp
```

Then restart Node-RED. After the restart the palette shows the new `ui-*`
nodes (grouped under *webapp*).

## Your first app, step by step

You will build: an app shell, a welcome text, and a button that navigates to
a second page.

1. **Add a `ui-app` node.** Drag it onto the canvas and open it. Give it the
   name `My first app`. The app node is the root of everything — it defines
   the URL your app is served under and the base layout (keep the default
   `app` layout: header / navbar / content / footer slots). You should see:
   a single app node on the canvas, no errors.
2. **Add a `ui-text` node.** Open it, and under **Parent Slot** pick your
   app's **content** slot (the mount picker shows a tree of all available
   slots). Set its text to `Hello from Node-RED!`. This is the structure
   rule in action: the text lives *inside* the app because of its **mount**,
   not because of any wire.
3. **Add a `ui-button` node.** Mount it into the same **content** slot and
   set its label to `Say hello`.
4. **Add a `ui-route` node.** Set its path to `/hello`, pick your app in the
   **App** field, and give it the `vertical` layout. Add another `ui-text`
   mounted into the route's **content** slot with the text
   `Hello! You navigated to your second page.`
5. **Wire the navigation.** Add a `ui-action` node, set its **App**, choose
   the action type `navigate`, and select the *wired route* target mode. Now
   wire: button output → action input, and action output → route input. The
   wire tells the action *which route* is the target — this is a data/event
   wire, not hierarchy.
6. **Deploy.** Click **Deploy**. The app node's status turns green and shows
   the number of connected clients.
7. **Open the app.** Browse to
   `http://localhost:1880/webapp/<your-app-id>/` (the app node's info
   sidebar shows the exact URL — the id is the app node's id). You see the
   welcome text and the button; clicking the button navigates to `/hello`
   and shows the second page.

## The complete flow as an import

The finished result of the steps above is included as an importable flow:
[`examples/guide/getting-started.json`](../../examples/guide/getting-started.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/getting-started.json` (or paste its JSON
   content) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/firstApp/` — click **Say hello**
   to navigate to the second page.

## Troubleshooting

- **Wrong port / page not found.** The app is served by *your Node-RED
  instance* — same host, same port (default `1880`). If you changed
  `uiPort` in `settings.js`, use that port. The path is always
  `/webapp/<app-id>/` (note the trailing slash), where `<app-id>` is the id
  of the `ui-app` node.
- **"Unknown node type: ui-app" after import.** The package is not installed
  in this Node-RED instance, or Node-RED was not restarted after an npm
  install. Install via the palette manager (no restart needed) or restart
  Node-RED after installing via npm.
- **Blank page.** Check that the components declare a **mount** — a view
  node without a parent slot is not part of the structure and cannot render.
  Also check the browser console and the Node-RED debug sidebar for
  structured errors.
- **Changes don't show up.** Every structural change needs a **Deploy**.
  Connected browsers re-render automatically after the deploy (no manual
  reload needed).

## Where next

- [Introduction](introduction.md) — the mental model behind what you just
  built.
- [Layout & Slots](guides/layout-slots.md) — how mounting and layout presets
  work.
- [Actions & Events](guides/actions-events.md) — what the button click
  actually did, and the two ways to trigger UI behaviour.
