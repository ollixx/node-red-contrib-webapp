# ui-avatar — Test Catalogue (P93)

Fresh tests written per `.ai/agents/node-testing.md`. Replaces the P43 presence-only tests.

## Unit tests (`packages/runtime/test/p93-avatar-rendering-bugfixes.test.ts`)

| Test | Goal |
|---|---|
| size 'sm' stored in mapConfig | mapConfig preserves size field |
| size 'lg' stored in mapConfig | mapConfig preserves size field |
| shape 'square' stored in mapConfig | mapConfig preserves shape field |
| shape 'circle' stored in mapConfig | mapConfig preserves shape field |
| plain-string initials stored in mapConfig | mapConfig stores initials string correctly |
| alt NOT emitted by mapConfig | alt field removed in P93 |
| size 'md' → data-size='md' | serializer emits data-size attr for sl-avatar |
| size 'sm' → data-size='sm' | serializer emits data-size attr |
| size 'lg' → data-size='lg' | serializer emits data-size attr |
| size absent → no data-size | no size attr when not configured |
| shape 'square' → shape='square' | serializer emits shape attr |
| shape 'circle' → no shape='square' | circle (default) not rendered as square |
| shape absent → no shape='square' | no shape attr when not configured |
| initials 'JD' → initials='JD' | serializer emits initials attr |
| initials 'AB' → initials='AB' | serializer emits initials attr |
| initials absent → no initials attr | no initials attr when not configured |
| initials not '[object Object]' | guard against binding-object stringification |
| alt NOT rendered | alt= must not appear in serializer output |
| renders sl-avatar element | basic smoke: correct element rendered |
| size + shape + initials combined | all three fields work together |

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
| initials 'JD' → initials='JD' | initials attr visible via browser property |
| initials not '[object Object]' | string initials don't produce object artefact |
| src literal → image attr set | src binding resolved to image attribute |
| alt NOT rendered | alt= attr absent from sl-avatar in browser |
| size + shape + initials combined | all three fields visible simultaneously |
