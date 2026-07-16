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
