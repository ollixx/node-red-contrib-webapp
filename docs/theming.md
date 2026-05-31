# Theming System

This document describes the design token system, the webapp-default backend, and the interface for community renderer backends.

## What a theme is (ADR 0002)

Per [ADR 0002](adr/0002-web-component-rendering-and-theming.md), a **theme is a triple** — it is purely presentational and **injects no node types**:

1. **A token set** — declarative values (colors, spacing, radii, fonts) on the `ui-app` `tokens` field.
2. **An adapter choice** — which generator renders the framework-agnostic `RenderSnapshot`.
3. **An adapter implementation** — the semantic-kind → framework-element mapping plus graceful fallbacks, living in the relevant generator package (below the snapshot seam).

Switching themes means swapping tokens + adapter; the flow and its node vocabulary are unchanged and portable. The node vocabulary stays semantic and framework-neutral (`variant: primary`, `size: md`), never framework tokens. A framework that lacks a native equivalent for a node degrades gracefully to a fallback rendering — it never adds a node type.

### Default adapter: Shoelace Web Components (P23)

The default rendering target is **Web Components** via **Shoelace 2.x (MIT)**, loaded as an ES module / static resource (no bundler). The adapter (`packages/renderer/src/shoelace-adapter.ts`) maps each semantic component kind to a Shoelace custom element and maps semantic props to attributes (`variant`, `size`). Kinds without a 1:1 Shoelace element fall back to semantic HTML, never an empty node.

Because Shoelace is themed natively through CSS custom properties, the `DesignTokens` (via `buildDesignTokenCss`) plug in directly: the `--wa-*` token properties are aliased to the corresponding `--sl-*` properties (`buildShoelaceTokenBridgeCss`) with no per-token translation.

### Component mapping (KIND_TO_SHOELACE) {#component-mapping}

The table below is the authoritative reference for `KIND_TO_SHOELACE` in `packages/renderer/src/shoelace-adapter.ts`. Every entry maps a semantic component kind to either a real Shoelace 2.x custom element or a documented semantic-HTML fallback.

| Semantic kind | Rendered as | Notes |
|---|---|---|
| `text` | `<div class="webapp-text">` (semantic HTML) | Shoelace 2.x has no general-purpose text element |
| `button` | `<sl-button>` | Variant + size mapped from semantic props |
| `table` | `<table>` (semantic HTML) | Shoelace 2.x has no table element |
| `input` | `<sl-input>` | label, type, name, value preserved |
| `card` | `<sl-card>` | |
| `container` | `<sl-card>` | Children projected via default slot |
| `select` | `<sl-select>` | Options rendered as `<sl-option>` children |
| `checkbox` | `<sl-checkbox>` | |
| `radio` | `<sl-radio-group>` | Individual options rendered as `<sl-radio>` children |
| `switch` | `<sl-switch>` | |
| `textarea` | `<sl-textarea>` | rows, maxLength preserved |
| `datepicker` | `<sl-input type="date">` | Shoelace 2.x has no native date-picker element |
| `slider` | `<sl-range>` | min, max, step preserved |
| `alert` | `<sl-alert>` | severity mapped to Shoelace variant (info→primary, error→danger) |
| `badge` | `<sl-badge>` | severity/variant mapped to Shoelace variant |
| `progress` | `<sl-progress-bar>` | value (0–100) preserved |
| `breadcrumb` | `<sl-breadcrumb>` | Items rendered as `<sl-breadcrumb-item>` children |
| `tabs` | `<sl-tab-group>` | Tabs rendered as `<sl-tab>` + `<sl-tab-panel>` pairs |
| `accordion` | `<div class="webapp-accordion">` wrapping `<sl-details>` | One `<sl-details>` per item |
| `menu` | `<sl-menu>` | Items rendered as `<sl-menu-item>` children |
| `avatar` | `<sl-avatar>` | image/initials/label preserved |

**Rule:** Every kind in `KIND_TO_SHOELACE` must be a real, shipping Shoelace 2.x custom element. Do not add non-existent element names (e.g. `sl-format-text`, `sl-table`). Kinds without a Shoelace equivalent must be omitted from the map and handled as semantic-HTML fallbacks in the server-side serializer (`nodes/webapp.js`).

## Design Tokens

Design tokens are declared on the `ui-app` node under the `tokens` field. They drive CSS Custom Properties injected into the page at runtime.

### Token fields

| Token field | CSS Custom Property | Default meaning |
|---|---|---|
| `colorPrimary` | `--wa-color-primary` | Primary brand color (buttons, links, focus rings) |
| `colorPrimaryFg` | `--wa-color-primary-fg` | Foreground color on primary backgrounds |
| `colorDanger` | `--wa-color-danger` | Danger/error color |
| `colorDangerFg` | `--wa-color-danger-fg` | Foreground color on danger backgrounds |
| `colorSuccess` | `--wa-color-success` | Success color |
| `colorSuccessFg` | `--wa-color-success-fg` | Foreground on success backgrounds |
| `colorWarning` | `--wa-color-warning` | Warning color |
| `colorWarningFg` | `--wa-color-warning-fg` | Foreground on warning backgrounds |
| `colorNeutral` | `--wa-color-neutral` | Neutral/secondary action color |
| `colorNeutralFg` | `--wa-color-neutral-fg` | Foreground on neutral backgrounds |
| `colorBackground` | `--wa-color-background` | Page background |
| `colorSurface` | `--wa-color-surface` | Card/panel surface color |
| `colorBorder` | `--wa-color-border` | Default border color |
| `colorText` | `--wa-color-text` | Primary text color |
| `colorTextMuted` | `--wa-color-text-muted` | Secondary/muted text |
| `fontFamily` | `--wa-font-family` | Base font stack |
| `fontSizeBase` | `--wa-font-size-base` | Base font size (e.g. `16px`) |
| `fontWeightNormal` | `--wa-font-weight-normal` | Normal weight (e.g. `400`) |
| `fontWeightBold` | `--wa-font-weight-bold` | Bold weight (e.g. `700`) |
| `lineHeightBase` | `--wa-line-height-base` | Base line height (e.g. `1.5`) |
| `spacingUnit` | `--wa-spacing-unit` | Base spacing unit (e.g. `4px`) |
| `radiusSm` | `--wa-radius-sm` | Small border radius (e.g. `2px`) |
| `radiusMd` | `--wa-radius-md` | Medium border radius (e.g. `6px`) |
| `radiusLg` | `--wa-radius-lg` | Large border radius (e.g. `12px`) |
| `radiusFull` | `--wa-radius-full` | Full/pill radius (e.g. `9999px`) |

All token fields are optional. Unset fields fall back to the webapp-default values or, if no default backend is active, to browser defaults.

### CSS injection

At runtime `buildDesignTokenCss(tokens)` (exported from `@node-red-contrib-webapp/schema`) produces a `:root { … }` CSS block from the tokens object. The block is injected as a `<style>` tag in the `<head>` of every rendered page.

Example output:

```css
:root {
  --wa-color-primary: #3b82f6;
  --wa-radius-md: 6px;
}
```

## Component Variants

Every view node exposes an optional `variant` field. The accepted values are validated by the node's Zod schema. Unknown variants fail schema validation at deploy time.

| Node | Valid variants |
|---|---|
| `ui-button` | `primary`, `secondary`, `danger`, `ghost`, `link` |
| `ui-input` | `default`, `filled`, `outlined` |
| `ui-select` | `default`, `filled`, `outlined` |
| `ui-checkbox` | `default`, `toggle` |
| `ui-radio` | `default`, `button` |
| `ui-switch` | `default`, `slim` |
| `ui-textarea` | `default`, `filled`, `outlined` |
| `ui-datepicker` | `default`, `inline` |
| `ui-slider` | `default`, `range` |
| `ui-container` | `default`, `card`, `panel`, `flat` |
| `ui-table` | `default`, `striped`, `bordered`, `compact` |
| `ui-text` | any non-empty string (open-ended for backends) |
| `ui-progress` | `bar`, `spinner`, `circular` (P16b) |
| `ui-skeleton` | `text`, `avatar`, `card`, `table` (P16b) |
| `ui-badge` | `count`, `dot`, `status` (P16b) |
| `ui-list` | `unordered`, `ordered`, `description` (P16d) |
| `ui-menu` | `sidebar`, `topbar` (P16c) |

The `variant` value is passed through to the renderer backend as a class name: `wa-variant-<value>`.

## webapp-default Backend

The webapp-default backend ships as a thin CSS layer that maps CSS Custom Properties to component styles. It is automatically active unless a custom backend is registered.

### Default token values (webapp-default)

```css
:root {
  --wa-color-primary:    #3b82f6;
  --wa-color-primary-fg: #ffffff;
  --wa-color-danger:     #ef4444;
  --wa-color-danger-fg:  #ffffff;
  --wa-color-success:    #22c55e;
  --wa-color-success-fg: #ffffff;
  --wa-color-warning:    #f59e0b;
  --wa-color-warning-fg: #000000;
  --wa-color-neutral:    #6b7280;
  --wa-color-neutral-fg: #ffffff;
  --wa-color-background: #ffffff;
  --wa-color-surface:    #f9fafb;
  --wa-color-border:     #e5e7eb;
  --wa-color-text:       #111827;
  --wa-color-text-muted: #6b7280;
  --wa-font-family:      system-ui, sans-serif;
  --wa-font-size-base:   16px;
  --wa-font-weight-normal: 400;
  --wa-font-weight-bold:   700;
  --wa-line-height-base:   1.5;
  --wa-spacing-unit:     4px;
  --wa-radius-sm:        2px;
  --wa-radius-md:        6px;
  --wa-radius-lg:        12px;
  --wa-radius-full:      9999px;
}
```

### Variant classes

For each component the backend maps `wa-variant-<value>` classes to styling rules:

```css
/* ui-button */
.wa-button.wa-variant-primary  { background: var(--wa-color-primary); color: var(--wa-color-primary-fg); }
.wa-button.wa-variant-danger   { background: var(--wa-color-danger);  color: var(--wa-color-danger-fg);  }
.wa-button.wa-variant-ghost    { background: transparent; border: 1px solid var(--wa-color-border); }
.wa-button.wa-variant-link     { background: transparent; color: var(--wa-color-primary); text-decoration: underline; }
/* … etc. */
```

## Backend Extension Interface

Community backends must implement the following contract to be registered as a webapp renderer backend.

### Registration

A backend registers itself by calling:

```js
RED.plugins.registerPlugin("my-backend", {
    type: "node-red-contrib-webapp-backend",
    onadd() {
        // Called when the plugin is registered.
    }
});
```

### Required exports

| Export | Signature | Description |
|---|---|---|
| `renderComponent(node, tokens)` | `(ComponentDefinition, DesignTokens?) => string` | Returns an HTML string for a single component node |
| `renderVariantClass(nodeType, variant)` | `(string, string) => string` | Returns a CSS class name for a variant |
| `getDefaultTokens()` | `() => DesignTokens` | Returns the backend's default token values |

### Token precedence

1. User-defined tokens on `ui-app` (highest)
2. Backend default tokens from `getDefaultTokens()`
3. Browser UA defaults (lowest)

Tokens not set by the user are **not** injected as CSS custom properties — the backend CSS is expected to supply fallback values using `var(--wa-color-primary, <fallback>)` syntax.

### Variant class contract

- Class name format: `wa-variant-<value>` (e.g. `wa-variant-danger`)
- Component wrapper class format: `wa-<node-type>` (e.g. `wa-button`, `wa-table`)
- Backends must not use `!important` for token-driven properties so user overrides work.

### Versioning

The backend interface version is `1`. Backends declare compatibility via:

```js
RED.plugins.registerPlugin("my-backend", {
    type: "node-red-contrib-webapp-backend",
    backendInterfaceVersion: 1,
    // …
});
```
