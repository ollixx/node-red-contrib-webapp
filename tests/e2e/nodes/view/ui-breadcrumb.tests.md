# ui-breadcrumb Test Catalogue (P95)

Per-node test catalogue as required by `.ai/agents/node-testing.md`.

## Unit Tests (`packages/runtime/test/p95-breadcrumb-redesign.test.ts`)

| Test | Goal |
|---|---|
| Serializer: object items carry data-webapp-source + data-webapp-breadcrumb-action | All items rendered with click hook (no selectivity) |
| Serializer: active item carries aria-current=page AND breadcrumb-action | Active items stay clickable with correct DOM attribute |
| Serializer: item without action defaults to label as action | Fallback action = label |
| Serializer: string items use string as both label and action | String items click hook correct |
| Serializer: string items — last item clickable (no positional exclusion) | P95 contract: no last-item exception |
| Serializer: breadcrumb layout renders items from default region | Child-slot mode (mode c) works |
| Serializer: separator slot content wrapped in slot=separator | Child-slot mode (mode d) separator works |
| mapConfig: array of objects passed through unchanged | Item resolution: pre-parsed array |
| mapConfig: array of strings passed through unchanged | Item resolution: string array |
| mapConfig: itemsJson (new editor format) resolved to parsed array | Item resolution: JSON literal from editor |
| mapConfig: binding object passed through as-is | Item resolution: dynamic binding |
| mapConfig: itemsPath (legacy) resolved as stateBinding | Back-compat: P75 itemsPath |
| mapConfig: events is always ['click'] | Event contract |
| mapConfig: layout='breadcrumb' preserved | Child-slot mode flag |
| mapConfig: other layout values not forwarded | breadcrumb-only layout field |
| Client: data-webapp-breadcrumb-action handler present | Client-side click dispatch |
| Client: handler dispatches event:'click' with params.action | Click event contract |
| Dispatch: click event lands on breadcrumb output port | End-to-end event routing |
| Also: P75 serializer tests updated for P95 (menu tests unchanged) | Regression: menu navigate-path still works |

## E2E Tests (`tests/e2e/nodes/view/ui-breadcrumb.spec.ts`)

| Test | Goal |
|---|---|
| renders sl-breadcrumb with correct number of items (object items) | Rendering: correct element count |
| string items: renders label text and dispatches string as action on click | String items: label + click |
| object items: click dispatches {event:click, params:{action}} | Object items: correct event payload |
| active item has aria-current=page in DOM and is still clickable | Active item: DOM + clickability |
| item without explicit action: label is used as action | Default action fallback |
| last item is also clickable (no positional selectivity in P95) | P95 key contract: all items clickable |
| empty items array → sl-breadcrumb with zero items (sibling still renders) | Empty items emit the container with zero `sl-breadcrumb-item`; sibling text still renders |
| separator string renders as slot=separator content (overrides native '/') | P248: a non-empty `separator` string is measured in the DOM as `<span slot="separator">` with the custom char — the field is honest, not inert |
| no separator prop → no slot=separator element (Shoelace native default) | P248 control: the slotted separator is only emitted when the string is set (value-driven, not always-on) |
| route/path item fires click (not navigate) with correct msg.ui envelope | P248 navigate-truth: even a route/path `action` ("/customers") emits `click`, never `navigate`; runtime is click-only (schema tolerates `["navigate"]` only as P75 back-compat) |

## P248 findings resolution

- **`separator` (finding A):** was **inert** — `mapConfig` carried it but `toComponentDefinitions`
  (nodes/webapp.js) dropped it before the serializer, and the static-items serializer branch
  never read `props.separator`. Resolved by the lower-risk **implement** path: `separator` now
  flows into `component.props` and the serializer slots a non-empty string into `slot="separator"`,
  overriding Shoelace's native `/`. Proven by the two measured E2E above (custom char present +
  control absent). The `layout="breadcrumb"` region-based separator (child node in slot `separator`)
  is unchanged and mutually exclusive by mode.
- **`navigate` (finding B):** breadcrumb runtime emits **`click` only** (`mapConfig` → `events:["click"]`,
  locked by the runtime unit "mapConfig: events is always ['click']"). A `navigate` event is **not**
  fired for any item, including route/path items — the P95 design collapsed all interactions to `click`
  (navigation happens via wiring `click` → `ui-action navigate`). The schema keeps `events:["navigate"]`
  only as intentional P75 back-compat (locked by schema test "accepts ui-breadcrumb with events:['navigate']").
  The E2E above measures the real envelope: a `/customers` item fires `click`, not `navigate`.
