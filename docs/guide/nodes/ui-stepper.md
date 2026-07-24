# ui-stepper

A multi-step process indicator (wizard bar) that guides the user through an
ordered sequence of steps.

> Deutsch: [de/nodes/ui-stepper.md](../de/nodes/ui-stepper.md)

## Purpose

`ui-stepper` renders a **wizard bar** for an ordered sequence of steps. Each step
has a content slot; only the active step's slot is shown. The active step is a
**two-way binding** (`activeStep`) — change it and the view switches; a step click
emits a `stepChange` event for the write-back loop. Steps are defined by a small
JSON array (`id` + `label`); children mount into `step:<id>` slots.

## When to use

- Multi-page forms, checkout flows, guided configuration dialogs.
- Show progress through an ordered sequence while only rendering the active step.
- For free switching between peer views (not an ordered process), use
  [`ui-tabs`](ui-tabs.md).

## Fields

| Field | What it does | Values / variants | Default |
|---|---|---|---|
| **Name** | Editor/picker display name. | free text | `Stepper N` |
| **Parent Slot** (`mount`) | The slot this stepper mounts into. Required. | mount path | — |
| **Steps (JSON array)** (`steps`) | The ordered steps, each `{ "id", "label" }`. At least two; ids unique. Each id yields a `step:<id>` slot and is the `activeStep` token. Required. | JSON array | — |
| **Active Step** (`activeStep`) | **Two-way** binding on the active step id. Reads the active step; the step click writes back (round-trip). Invalid → first step. Required. | `state`, `store`, `query`, `routeParam`, `literal`, `msg`, `flow`, `global`, `jsonata`, `env` | first step |
| **Orientation** (`orientation`) | Bar orientation. **Real** (P251): `horizontal` lays steps side by side, `vertical` stacks them. Stored as `variant` internally. | `horizontal`, `vertical` | `horizontal` |
| **Events** (`events`) | Enables the `stepChange` output port. | `stepChange` | none |
| **Visible** / **Color** | Base fields. | — | — |

`Disabled` and `Size` are N/A (a stepper shows progress and has no disabled state
or size steps). A former `complete` event and a dead `linear` field were **removed**
(P251) — no DOM source fired `complete`, and `linear` was never enforced; legacy
flows carrying them are cleaned up losslessly.

## Inputs

`ui-stepper` **has an input port**:

- **`msg.payload`** — sets the active step; the value must be one of the `steps`
  ids.
- **`msg.ui.patch`** — overrides fields (e.g. `steps`, `variant`).
- **`msg.ui.component.op`** (`show`, `hide`) — toggles the whole block.
- Unrecognised / foreign messages **pass through unchanged**.

## Outputs / Events

When `stepChange` is enabled, `ui-stepper` has one output port:

| Event | When | `msg.ui` fields |
|---|---|---|
| `stepChange` | user clicks a different step | `event: "change"`, `params.value` (the step **index**), `clientId`, `sourceId`, `appId` |

Note the shape: the DOM event carries `params.value` = the step **index** (while
`activeStep`/`msg.payload` address a step by its **id**). Wire `stepChange` →
`ui-store-action` (`set`) on the store the `activeStep` binding reads to close the
loop. There is no `complete` event — wire process completion from a "Done" button
in the last step's slot instead.

## Examples

### 1. A three-step wizard with a store write-back

An Account/Profile/Confirm stepper. `activeStep` reads a store value; `stepChange`
writes the change back — the two-way loop.

Flow file: [`examples/guide/ui-stepper.json`](../../../examples/guide/ui-stepper.json)

Import instructions:

1. In Node-RED open the menu (☰) → **Import**.
2. Select `examples/guide/ui-stepper.json` (or paste its JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/guideStepper/` — the wizard renders
   with the active step's content; clicking a step emits `stepChange`.

## Related

- [`ui-tabs`](ui-tabs.md) — free switching between peer views
- [Bindings & State](../guides/bindings-state.md) — two-way bindings, stores
- Contract doc (internal, German): `docs/nodes/navigation/ui-stepper.md`
