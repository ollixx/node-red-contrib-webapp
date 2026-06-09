# P104 — Central Value Rendering — Test Catalogue

Phase: **P104**. Cross-cutting feature, not a single node: one central
normalization (`normalizeDisplayValue` in `packages/renderer/src/renderer.ts`)
governs how every value-binding **display** node renders its bound value.
Contract: `docs/nodes/concepts/value-rendering.md` §1.

## Contract (one rule, applied centrally)

| Raw value | Rendered |
|---|---|
| non-empty string | unchanged |
| `number` / `boolean` / `bigint` | `String(value)` — `0` → `"0"`, `false` → `"false"` |
| `""` (real empty string) | empty (element rendered, no content) |
| `null` / `undefined` | `"?"` |
| object / array / function / symbol | `"?"` (never `[object Object]`, never a JSON dump, never a crash) |

`0` and `false` are **valid** values, never treated as empty.

## Unit tests

### `packages/renderer/test/renderer.test.ts` — `normalizeDisplayValue` + snapshot outcomes

| Test | Goal |
|---|---|
| non-empty string passes through | base case |
| number/boolean/bigint stringified incl. `0`/`false` | falsy-but-valid scalars are not empty |
| `""` stays empty | deliberate "nothing" is preserved |
| `null`/`undefined` → `"?"` | not-displayable sentinel |
| object/array/function/symbol → `"?"` | non-scalars never leak |
| text node — value table (`0`,`false`,`""`,`null`,`undefined`,obj,array) | snapshot `text` matches the contract |
| badge node — value table | snapshot `value` matches the contract |
| unknown store id (value resolves to undefined) → `"?"` | undefined display value is the visible sentinel, not silent empty |

### `packages/runtime/test/p104-central-value-rendering.test.ts` — full pipeline (renderer → serializer → DOM)

| Test | Goal |
|---|---|
| ui-text value table → DOM text | the produced HTML carries the normalized text |
| ui-text object → `">?<"`, never `[object Object]`/JSON | non-scalar guard in the real markup |
| ui-badge value table → DOM text inside `sl-badge` | the badge content is the normalized text |

## E2E tests (`p104-central-value-rendering.spec.ts`)

| Test | Goal |
|---|---|
| ui-text `0` → "0" | falsy number is a valid value in the live browser |
| ui-text `false` → "false" | falsy boolean is valid |
| ui-text `""` → empty content | deliberate empty stays empty (no "?") |
| ui-text `null` → "?" | non-displayable sentinel in the DOM |
| ui-text object → "?", not `[object Object]` | non-scalar guard end-to-end |
| ui-text array → "?" | array is non-scalar |
| ui-badge `0` → "0" inside sl-badge | falsy number valid in badge |
| ui-badge `false` → "false" | falsy boolean valid in badge |
| ui-badge `null` → "?" | sentinel inside sl-badge |
| ui-badge object → "?", not `[object Object]` | non-scalar guard inside sl-badge |
