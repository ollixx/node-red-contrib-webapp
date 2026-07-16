# ui-badge — Test Catalogue

Phase: **P153** (valuePath → value typedInput, ADR 0012). Built on P103 (size-Feld entfernt) and P92 (Felder-Rework: displayType square/rounded/pill, variant rename, pulsating, max removed).

All tests are in `ui-badge.spec.ts` (E2E, Playwright) and `packages/runtime/test/p92-badge-fields-rework.test.ts` + `packages/runtime/test/p103-badge-remove-size.test.ts` + `packages/runtime/test/p153-badge-value-typedinput.test.ts` (unit).

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
| size field removed — not emitted by mapConfig (P103) | size gone; old config with size → no size in result |
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
| size removed — no data-size attribute (P103) | Size field gone; no data-size ever emitted |
| old size in props → no data-size (P103 back-compat) | Old snapshots still render correctly |
| value is rendered inside sl-badge | Value binding passes to content |
| max field not present in output | Removed field does not appear in markup |
| pill + pulsating + variant combined, no data-size (P103) | All attributes are independent and compose correctly |

## Unit tests (`p103-badge-remove-size.test.ts`)

### mapConfig — size removed

| Test | Goal |
|---|---|
| size field NOT emitted (old config with size='sm') | Back-compat: old flows load without size flowing through |
| size 'md' in old config → not in result | Covers md value |
| size 'lg' in old config → not in result | Covers lg value |
| other fields unaffected when size present in old config | No regression on variant/displayType/pulsating |

### Serializer — no data-size

| Test | Goal |
|---|---|
| no size in props → no data-size | Default rendering has no data-size |
| size 'sm' in props (old snapshot) → no data-size | Old snapshots do not emit data-size |
| size 'lg' in props (old snapshot) → no data-size | Old snapshots do not emit data-size |
| sl-badge rendered correctly without size | Core badge rendering intact |
| pill + pulse + variant, no data-size | All retained attrs compose; no spurious data-size |

## Unit tests (`p153-badge-value-typedinput.test.ts`)

### mapConfig — value typedInput (P153)

| Test | Goal |
|---|---|
| migrates legacy valuePath (plain string) → state binding for value | valuePath back-compat: old flows render without changes |
| prefers stored value binding object over valuePath | New binding object wins when both present |
| accepts literal string binding for value | Literal string value passes through |
| accepts literal number binding for value | Literal number value passes through |
| falls back to state binding from valuePath when value not present | Migration covers valuePath-only flows |
| passes displayType, variant, pulsating through unchanged | No regression on other fields |

## E2E tests (`ui-badge.spec.ts`)

| Test | Goal |
|---|---|
| renders sl-badge with literal value | sl-badge element is present with correct text |
| default state (no variant/displayType) → sl-badge shows the literal value | Default rendering shows the bound value ("0") end-to-end |
| displayType 'pill' → sl-badge has pill attribute | Shoelace pill attribute visible in browser |
| displayType 'rounded' → no pill attribute | No pill attr for default shape |
| displayType 'square' → data-display-type='square' | Custom attr for square shape |
| variant 'success' → sl-badge variant='success' | Colour role attribute in browser DOM |
| variant 'danger' → sl-badge variant='danger' | Colour role attribute in browser DOM |
| variant 'warning' → sl-badge variant='warning' | Colour role attribute in browser DOM |
| pulsating: true → sl-badge has pulse attribute | Shoelace pulse attribute in browser |
| pulsating omitted → no pulse attribute | Default: no pulse in browser |
| no size field → no data-size attribute (P103) | Size removed: no data-size in browser DOM |
| legacy valuePath renders badge value (P153 migration) | Old flows with valuePath render without crash |
| pill + pulsating + variant 'primary' combined, no data-size (P103) | All attributes compose correctly; no data-size |
