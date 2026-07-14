# ui-alert — Test Catalogue

Phase: **P225** (Duration as a declarative `visible=false` state transition, ADR 0037). Supersedes the P100/P91 duration auto-hide mechanism (client-side one-way close + `autoDismissed`). Extends P90 (icon field + icon logic).

All tests are in `ui-alert.spec.ts` (E2E, Playwright), `packages/runtime/test/p90-alert-icon.test.ts` (unit), `packages/runtime/test/p91-alert-duration-countdown.test.ts` (unit — duration/countdown attribute emission), and `packages/runtime/test/p225-duration-visible-transition.test.ts` (unit — the duration→`visible=false` value transition via `setDynamicStateField`).

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
| visible = msg: an incoming message toggles the alert on and off | P223 (ADR 0036) — a `msg`-bound `visible` toggles live: `msg`→true shows, `msg`→false hides (the owner's bug). Also proves boolean coercion + the live-patch merge carrying `visible`→`visibleIf`. |
| D1 duration → after elapse the alert is REMOVED from the DOM | P225 (ADR 0037) — the duration hide is a real `visible=false` value transition: the element is DETACHED (count 0), not open=false-but-present. Mutation-red against a revert to the client-side `autoDismissed` close. |
| D2 countdown=true + duration → bar runs, then removed | The P100 countdown (`countdown="ltr"`) still runs across the duration; only the hide is now a value transition (element removed). |
| D3 re-triggerable — writing visible=true re-shows the alert | After the duration hide, a `msg.ui.dynamicState` write of `visible=true` (per-client, via a button→function) re-shows the alert with no reload. |

## Duration = `visible` value transition (P225, ADR 0037)

Unit coverage in `packages/runtime/test/p225-duration-visible-transition.test.ts`:
the browser-reachable `dispatchDynamicStateWrite` seam routes the duration hide
through `setDynamicStateField` — UNBOUND `visible` → the per-client slot flips to
false; BOUND `visible` → the store slice is written through; re-triggerable by
writing `true` again; per-client isolation; and the dispatch guards (missing
id/field → 400, unknown node → 400, read-only bound source → 409). No
`autoDismissed` flag; no "always emit open" overlay.

## Message mode — every msg-bound field (P223, ADR 0036)

Unit coverage lives in `packages/runtime/test/p223-message-mode-all-fields.test.ts`:
a non-primary `msg`-bound field (`visible`) updates from its own message prop;
boolean coercion (`true`/`false` + `"true"`/`"false"`); multiple msg-bound fields
on one node each from their own path; a JSONata non-primary field; primary-field +
legacy bare-payload back-compat; and the live-patch merge (`computeLiveViewPatch`)
carrying `visible`/`disabled`.

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
