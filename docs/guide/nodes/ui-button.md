# ui-button

A clickable button — the event source of your app, or a real link.

> Deutsch: [de/nodes/ui-button.md](../de/nodes/ui-button.md)

## Purpose

`ui-button` renders a button. In its default mode it is an **event source**: a
click leaves the node's output port and the flow decides what happens. Two
other link modes turn it into a hyperlink or into in-app navigation. Colour is
expressed through **Variant** — the "variant = colour" convention.

## When to use

- Trigger something: save, delete, open a dialog, run a flow branch.
- Navigate inside the app (`linkMode = navigate`) or leave it
  (`linkMode = url`).
- For the wiring patterns behind a click, see
  [Actions & Events](../guides/actions-events.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Display name in the editor and in pickers. | free text | `Button N` |
| **Parent Slot** (`mount`) | Where the button is placed. Required. | mount picker | — |
| **Label** (`label`) | The button caption. Required and **fully bindable** — a literal or a store/query/route-param/… binding (a store-bound label updates live). | binding / literal text | — |
| **Icon** (`icon`) | Icon rendered in the button's prefix slot. Backend-neutral `library:name` (a bare name uses the default library); a picker button opens the icon chooser. Bindable. | binding / `plus` / `lucide:user` | empty |
| **Disabled** (`disabled`) | Bindable boolean. When it resolves to `true` the button is disabled and emits **no** click events. | binding (boolean set) | unset |
| **Variant** (`variant`) | Semantic role **and colour**. | `primary` / `secondary` / `success` / `danger` / `warning` / `neutral` / `ghost` / `link` | `neutral` |
| **Size** (`size`) | Three-step size. Empty leaves the backend default. | `(default)` / `sm` / `md` / `lg` | empty |
| **Outline** (`outline`) | Draw the button outlined instead of filled. Independent of the variant styling. | checkbox | `false` |
| **Link Mode** (`linkMode`) | `button` = event source (click on the output port); `url` = a real hyperlink (renders an `<a>`); `navigate` = client-side in-app navigation to the route in **URL / Route**, and the click is *additionally* reported to the flow. | `button` / `url` / `navigate` | `button` |
| **URL / Route** (`href`) | The target for `url` / `navigate`. Bindable. The editor only shows this row in those two modes. | binding / literal text | empty |
| **Visible** (`visible`) | Bindable render gate — **see [Known gaps](#known-gaps): it currently has no effect on `ui-button`.** | binding (boolean set) | unset |
| **Order / Row / Col / Col Span / Row Span / X / Y** | Placement inside the parent slot — see [Layout & Slots](../guides/layout-slots.md). | numbers | empty |

`ui-button` has **no `color` base field** — that is by design: the button's
colour comes from **Variant**.

> **Deprecated:** an `action` field (a direct action-id reference) is still
> accepted by the schema for backwards compatibility. New flows wire the output
> port to a [`ui-action`](ui-action.md) node instead.

## Inputs

`ui-button` **has an input port**.

| Message | Effect |
|---|---|
| `msg.ui.component.op` | `show` / `hide`, `enable` / `disable` — toggles visibility / interactivity without touching the binding. |
| `msg.ui.patch` | Overwrites arbitrary fields of the node definition. |
| `msg.payload` (non-null) | *Contract:* overwrites the `label`. **Measured (P236): this does not reach the client** — see [Known gaps](#known-gaps). |
| anything else | **Passed through unchanged**, no error. |

## Outputs / Events

`ui-button` **has one output port**.

| Event | When | `msg.ui` |
|---|---|---|
| `click` | the user clicks the button and it is not disabled | `event: "click"`, `sourceId`, `appId`, `clientId` |

`msg.ui.params` is **empty** for `click` — the button carries no payload of its
own. Additional data (the current form state, a selected id) comes from wired
`ui-store` / `ui-query` nodes. In `navigate` mode the click both navigates and
emits the event.

## Known gaps

Measured in the P236 conformance pass; both are locked by tests that assert the
*real* behaviour, so they flip green when the bug is fixed:

- **`visible` does not gate the render.** `ui-button` is one of the
  hand-branched node types whose config mapping never wires `visible` to the
  runtime's render gate. A bound `visible = false` is discarded and the button
  renders anyway. Use `msg.ui.component.op: "hide"` or a conditional container
  until this is fixed.
- **`msg.payload` does not update the label.** The live-view patch does not
  carry the `label` field, so a payload-driven label change never reaches the
  browser. Bind **Label** to a store slice and write the store instead.

`color` being absent is **not** a gap — it is the variant convention.

## Examples

### 1. A click that opens a dialog, plus a link button

Two buttons: a `primary` one wired to a `ui-action` that opens a dialog, and a
`link`-variant button in `url` mode pointing at an external page.

Flow file: [`examples/guide/ui-button.json`](../../../examples/guide/ui-button.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-button.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideButton/` and click both buttons.

## Related

- [Actions & Events](../guides/actions-events.md) — what to wire a click to
- [`ui-action`](ui-action.md) — the usual follow-up node
- [`ui-dialog`](ui-dialog.md) — a common click target
- [Theming & Components](../guides/theming-components.md) — the variant vocabulary
- Contract doc (internal, German): `docs/nodes/display/ui-button.md`
