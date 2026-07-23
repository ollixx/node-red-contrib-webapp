# Theming & Components

One token set themes everything; variants pick semantic roles; component
definitions make subtrees reusable.

> Deutsch: [../de/guides/theming-components.md](../de/guides/theming-components.md)

## Goal

Give an app its own look via design tokens, understand the
variant-vs-colour model, and build a reusable card component rendered
twice with different props.

## Prerequisites

- [Layout & Slots](layout-slots.md) and
  [Bindings & State](bindings-state.md).

## Design tokens: the theme

A theme is a flat set of named values, configured on the `ui-app` node
(**Design Tokens** dialog). Each token maps to a CSS custom property
(`--wa-*`) that every component consumes:

| Token group | Examples | CSS variables |
|---|---|---|
| Semantic colours | `colorPrimary`/`colorPrimaryFg`, `colorSuccess`, `colorWarning`, `colorDanger`, `colorNeutral` | `--wa-color-primary`, `--wa-color-primary-fg`, … |
| Surfaces & text | `colorBackground`, `colorSurface`, `colorBorder`, `colorText`, `colorTextMuted` | `--wa-color-background`, … |
| Typography | `fontFamily`, `fontSizeBase`, `fontWeightNormal`/`Bold`, `lineHeightBase` | `--wa-font-family`, … |
| Spacing & radii | `spacingUnit`, `radiusSm`/`Md`/`Lg`/`Full` | `--wa-spacing-unit`, `--wa-radius-md`, … |

The theme is additive: set only what you want to change, everything else
falls back to the system defaults. Changing a token restyles the whole
app — your own components and the underlying web components alike.

## Variants and colours

Two fields control how a component looks, and a node offers **one of
them, never both**:

- **Variant** — a semantic *role* from the node's fixed vocabulary:
  `ui-button` has `primary`, `secondary`, `success`, `danger`,
  `warning`, `neutral`, `ghost`, `link`; `ui-text` has `heading-1..3`,
  `body`, `caption`, `label`, `code`, `muted`; and so on. The theme
  decides what a role looks like — a `primary` button follows
  `colorPrimary` wherever the app goes.
- **Color** — the superset for nodes without a variant: the same theme
  tokens **plus any colour**. The field offers three author paths: pick a
  **theme token** (stored as `token:primary` etc. — it keeps following
  the theme), pick or type **any CSS colour** (fixed, theme-independent),
  or **bind** the colour to a live source.

Rule of thumb: prefer variants/tokens — they keep the app consistent and
re-themeable. Reach for a free colour only when the design really calls
for that exact value.

## Reusable components

A recurring subtree (a card, a labelled stat, a list row) becomes a
**component**:

- **`ui-component-definition`** — an off-canvas template. Mount its
  children into the definition's template slot; inside, the **prop**
  binding kind reads a named parameter (`prop.title`, `prop.body`).
  The definition itself never renders.
- **`ui-component-instance`** — mounts anywhere like a normal view node,
  references a definition, and sets a **props** map (name → value; any
  binding kind — a prop can be a literal, a store binding, …). Each
  instance renders the template with its own prop values; a store-bound
  prop updates that instance live.

Components are props-in/events-out: events from nodes inside an instance
carry the instance's identity, so your flow can tell the clones apart.

## Steps

1. Create an app and open its **Design Tokens**: set `colorPrimary` to
   `#7c3aed` (and, say, `radiusMd` to `12px`). Deploy — everything
   primary in the app is now purple.
2. Mount a `ui-text` with variant `heading-2` and two `ui-button`s with
   variants `primary` and `danger`. The primary button wears the theme
   colour; the danger button the danger token.
3. Mount two `ui-divider`s with a label: give one the **Color** token
   `primary` (it follows the theme), the other a fixed colour like
   `#e91e63` (it never changes). Re-colour the theme and watch the
   difference.
4. Create a `ui-component-definition` "Card" with two `ui-text` children
   bound to `prop.title` and `prop.body`. Mount two
   `ui-component-instance`s into the app content with different
   title/body props. Deploy: the same template renders twice with
   different content.

## Example flow

The finished result of the steps:
[`examples/guide/theming-components.json`](../../../examples/guide/theming-components.json)

1. In Node-RED open the menu (☰) → **Import**.
2. Select the file `examples/guide/theming-components.json` (or paste its
   JSON) → **Import**.
3. Click **Deploy**.
4. Open `http://<your-node-red>:1880/webapp/themeApp/` — purple primary
   styling, the two dividers, and the card rendered twice.

## Where next

- [Displaying data](displaying-data.md) — combine components with
  `ui-repeat` for data-driven cards.
- Node reference: see the node list in the
  [guide home](../README.md#contents).
