# ui-alert — Test Catalogue

Phase: **P91** (duration + countdown fields). Extends P90 (icon field + icon logic). Replaces the P43 presence-only tests.

All tests are in `ui-alert.spec.ts` (E2E, Playwright), `packages/runtime/test/p90-alert-icon.test.ts` (unit), and `packages/runtime/test/p91-alert-duration-countdown.test.ts` (unit).

## Unit tests (`p90-alert-icon.test.ts`)

| Test | Goal |
|---|---|
| icon absent → no `icon` property in mapConfig result | Verify backward-compat: legacy nodes without `icon` produce no icon prop |
| icon='auto' → preserved in mapConfig | mapConfig passes through the sentinel value |
| icon='none' → preserved in mapConfig | mapConfig passes through the suppress-icon sentinel |
| explicit icon name → preserved in mapConfig | mapConfig preserves plain icon-name strings |
| icon binding → preserved in mapConfig | Dynamic bindings (state/store/…) round-trip through mapConfig |
| icon='auto' + severity='info' → name='info-circle' | Severity-derived icon: info/primary variant |
| icon='auto' + severity='success' → name='check-circle' | Severity-derived icon: success variant |
| icon='auto' + severity='warning' → name='exclamation-triangle' | Severity-derived icon: warning variant |
| icon='auto' + severity='danger' → name='x-circle' | Severity-derived icon: danger variant |
| icon='auto' + severity='neutral' → name='circle' | Severity-derived icon: neutral variant |
| icon='auto' + severity='primary' → name='info-circle' | Severity-derived icon: primary variant |
| icon='none' → no `<sl-icon>` | Explicit suppression of the icon slot |
| icon absent → no `<sl-icon>` | Default (no icon) when field is not configured |
| explicit icon='bell' → name='bell' in slot='icon' | Custom icon name passed through |
| icon={library,name} → name in slot='icon' | Icon value object (library + name) passed through |
| sl-alert still contains message text | Message rendering is not broken by icon changes |

## Unit tests (`p91-alert-duration-countdown.test.ts`)

| Test | Goal |
|---|---|
| duration absent → no `duration` property in mapConfig | No duration prop when field is empty/absent |
| countdown absent → no `countdown` property in mapConfig | No countdown prop when field is absent |
| duration=5000 → mapConfig result.duration === 5000 | Number value preserved as number |
| duration='3000' (string) → coerced to 3000 | String from editor number input is coerced |
| countdown=true → mapConfig result.countdown === true | Boolean value preserved |
| countdown='true' (string) → coerced to true | String from editor checkbox is coerced |
| countdown=false → falsy in mapConfig result | False/absent values are not serialized |
| duration=5000 → sl-alert has duration='5000' attribute | Shoelace duration attribute emitted |
| duration=3000 → sl-alert has duration='3000' attribute | Correct value emitted |
| duration absent → NO duration attribute | No attribute emitted when field is absent |
| countdown=true + duration → countdown='ltr' attribute | Shoelace countdown attribute emitted |
| countdown=true without duration → countdown still emitted | Edge case does not crash |
| countdown absent → NO countdown attribute | No attribute when countdown not set |
| countdown=false → NO countdown attribute | False value does not emit attribute |
| duration+countdown → sl-alert still present and open | Core rendering unaffected by new attrs |

## E2E tests (`ui-alert.spec.ts`)

| Test | Goal |
|---|---|
| severity 'warning' → sl-alert variant='warning' | Shoelace variant attribute matches severity |
| message literal is rendered as alert content | Message binding resolves to visible text |
| icon='auto' + severity='warning' → sl-icon name='exclamation-triangle' | Auto icon in browser DOM |
| icon='auto' + severity='success' → sl-icon name='check-circle' | Auto icon in browser DOM |
| icon='auto' + severity='danger' → sl-icon name='x-circle' | Auto icon in browser DOM |
| icon='auto' + severity='info' → sl-icon name='info-circle' | Auto icon in browser DOM |
| icon='none' → no sl-icon | Suppress-icon sentinel works end-to-end |
| icon absent → no sl-icon | Default (no icon) works end-to-end |
| explicit icon='bell' → sl-icon name='bell' | Custom icon name visible in browser |
| dismissible=true → closable attribute | Dismiss affordance rendered correctly |
| title binding → `<strong>` inside sl-alert | Title binding rendered in browser |

## Base fields (ADR 0015) — `tests/e2e/nodes/editor/base-fields.spec.ts`

Retrofitted: ui-alert previously had **no** `visible` editor field (the declarative
visibility foundation the spec describes). It now installs the shared base-field
group.

| Test | Goal |
|---|---|
| base-field group with 'Allgemein' heading is injected | ui-alert now exposes the shared base-field group |
| visible (applicable) is a boolean-state typedInput | `visible` is configurable (the missing field) |
| color is N/A (colour comes from severity) | `color` correctly marked N/A with the severity hint |
| visible binding round-trips through save | a `visible` binding persists open→save→reopen (ADR 0031) |
