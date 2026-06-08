# ui-badge — Test Catalogue

Phase: **P92** (Felder-Rework: displayType square/rounded/pill, variant rename, pulsating, size, max removed). Replaces P43 presence-only tests.

All tests are in `ui-badge.spec.ts` (E2E, Playwright) and `packages/runtime/test/p92-badge-fields-rework.test.ts` (unit).

## Unit tests (`p92-badge-fields-rework.test.ts`)

### mapConfig

| Test | Goal |
|---|---|
| variant from config.variant → preserved | variant field read correctly |
| back-compat: severity → becomes variant | Old flows with severity field still work |
| displayType 'pill' → preserved | Pill shape passes through mapConfig |
| displayType 'square' → preserved | Square shape passes through mapConfig |
| displayType 'rounded' → preserved | Rounded shape passes through mapConfig |
| legacy displayType 'count' → mapped to 'rounded' | Back-compat for old flows |
| legacy displayType 'dot' → mapped to 'rounded' | Back-compat for old flows |
| legacy displayType 'status' → mapped to 'rounded' | Back-compat for old flows |
| pulsating: true → preserved | Pulsating boolean passes through mapConfig |
| pulsating: 'true' (string) → coerced to true | Editor checkbox string coerced |
| pulsating absent → falsy | Default: no pulsating |
| size 'sm' → preserved | Small size passes through mapConfig |
| size 'lg' → preserved | Large size passes through mapConfig |
| size absent → falsy | Default: no size |
| max field removed — not emitted | max is a removed field, must not appear |

### Serializer

| Test | Goal |
|---|---|
| variant 'success' → variant='success' on sl-badge | Colour role correctly rendered |
| variant 'danger' → variant='danger' on sl-badge | Colour role correctly rendered |
| back-compat: severity in props → used as variant | Old snapshot data still renders correctly |
| no variant → default neutral variant rendered | Default variant always set |
| displayType 'pill' → sl-badge has pill attribute | Shoelace pill attribute emitted |
| displayType 'square' → data-display-type='square' | Custom CSS attribute emitted |
| displayType 'rounded' → no pill / no data-display-type | Default: no extra attributes |
| displayType absent → no pill attribute | Default rendering |
| pulsating: true → sl-badge has pulse attribute | Shoelace pulse attribute emitted |
| pulsating absent → no pulse attribute | Default: no pulse |
| size 'sm' → data-size='sm' | Size data attribute emitted |
| size 'md' → data-size='md' | Size data attribute emitted |
| size 'lg' → data-size='lg' | Size data attribute emitted |
| size absent → no data-size attribute | Default: no size attr |
| value is rendered inside sl-badge | Value binding passes to content |
| max field not present in output | Removed field does not appear in markup |
| pill + pulsating + variant combined | All attributes are independent and compose correctly |

## E2E tests (`ui-badge.spec.ts`)

| Test | Goal |
|---|---|
| renders sl-badge with literal value | sl-badge element is present with correct text |
| renders without explicit variant or displayType | Default rendering works end-to-end |
| displayType 'pill' → sl-badge has pill attribute | Shoelace pill attribute visible in browser |
| displayType 'rounded' → no pill attribute | No pill attr for default shape |
| displayType 'square' → data-display-type='square' | Custom attr for square shape |
| variant 'success' → sl-badge variant='success' | Colour role attribute in browser DOM |
| variant 'danger' → sl-badge variant='danger' | Colour role attribute in browser DOM |
| variant 'warning' → sl-badge variant='warning' | Colour role attribute in browser DOM |
| pulsating: true → sl-badge has pulse attribute | Shoelace pulse attribute in browser |
| pulsating omitted → no pulse attribute | Default: no pulse in browser |
| size 'sm' → data-size='sm' | Size data attribute in browser |
| size 'lg' → data-size='lg' | Size data attribute in browser |
| no size → no data-size attribute | Default: no size in browser |
| pill + pulsating + variant 'primary' + size 'md' combined | All attributes compose correctly in browser |
