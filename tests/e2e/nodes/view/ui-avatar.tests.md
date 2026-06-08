# ui-avatar — Test Catalogue (P94)

Fresh tests written per `.ai/agents/node-testing.md`. Replaces the P93 tests.
P94 adds: `image` typedInput (all binding kinds incl. Asset + Store), `initials` as full
typedInput binding, `variant` → `data-variant` attribute (Shoelace has no native variant).

## Unit tests (`packages/runtime/test/p94-avatar-field-extension.test.ts`)

| Test | Goal |
|---|---|
| src literal binding preserved by mapConfig | mapConfig passes literal URL binding through |
| src store binding preserved by mapConfig | mapConfig passes store binding through |
| legacy srcPath → state binding back-compat | old plain-state-path flows still work |
| initials literal binding preserved by mapConfig | mapConfig wraps/passes literal initials binding |
| initials plain string (legacy pre-P94) → literal binding | back-compat: string promoted to literal binding |
| variant field preserved by mapConfig | variant field passed through correctly |
| variant field absent → undefined | no variant → undefined in definition |
| initials literal 'JD' → initials='JD' in serializer | serializer emits initials attr for literal value |
| initials absent → no initials attr | no attr when not configured |
| initials as binding object (unresolved) → NO '[object Object]' | guard in serializer against non-string |
| variant 'primary' → data-variant='primary' in serializer | serializer emits data-variant attr |
| variant 'danger' → data-variant='danger' in serializer | serializer emits data-variant attr |
| no variant → no data-variant attr | absent variant produces no attr |
| variant does NOT emit native 'variant' attr | Shoelace has no native variant; must use data-variant |

## E2E tests (`tests/e2e/nodes/view/ui-avatar.spec.ts`)

| Test | Goal |
|---|---|
| renders sl-avatar in DOM | node registers and renders sl-avatar element |
| default state renders without error | no crash, no initials/image attr by default |
| size 'sm' → data-size='sm' | size rendered in browser via data attribute |
| size 'lg' → data-size='lg' | size rendered in browser |
| no size → no data-size | absent size produces no data-size attr |
| shape 'square' → shape='square' | shape attr visible in browser DOM |
| shape 'circle' → not 'square' | circle default not rendered as square |
| initials literal 'JD' → initials='JD' | initials typedInput literal visible via browser property |
| initials NOT '[object Object]' | binding object guard — no artefact in outerHTML |
| initials store binding → resolved from store string | store-backed initials displayed correctly |
| src literal URL → image attr set | image typedInput literal resolved to image attribute |
| src store binding → image attr from store URL | store-backed image URL displayed correctly |
| alt NOT rendered | alt= attr absent from sl-avatar in browser (removed P93) |
| variant 'primary' → data-variant='primary' | variant emitted as data-variant in browser |
| variant 'danger' → data-variant='danger' | variant boundary value |
| no variant → no data-variant | absent variant produces no attr |
| variant: data-variant set, NOT native variant attr | Shoelace has no native variant — must use data-variant only |
| size + shape + initials + variant combined | all four P94 fields visible simultaneously |
| src URL set → image attr is URL, no initials shown | fallback chain: src wins over initials |
| legacy plain-string initials (pre-P94) still work | back-compat for old flows |
