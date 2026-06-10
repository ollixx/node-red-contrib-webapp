# ui-store — Test Catalogue

Phase: **P110** (scope guard). Extends P80 (store-operation schema validation) and P46 (initial value + SSE live updates).

Unit tests live in `packages/runtime/test/p110-store-scope-guard.test.ts` and `packages/runtime/test/p80-store-operation-schema-validation.test.ts`.
E2E tests live in `tests/e2e/nodes/behavior/ui-store.spec.ts`.

## Unit tests (`p110-store-scope-guard.test.ts`)

### scope=any (default) — no guard

| Test | Goal |
|---|---|
| store without scope field accepts a broadcast message (no clientId) | Back-compat: old configs (no scope) pass through unchanged |
| store without scope field accepts a per-client message (with clientId) | Back-compat: per-client write allowed when no scope declared |
| store with explicit scope=any accepts a broadcast message | Explicit `any` behaves identically to absent scope |
| store with explicit scope=any accepts a per-client message | Explicit `any` allows both message kinds |

### scope=broadcast-only guard

| Test | Goal |
|---|---|
| broadcast-only store rejects message WITH clientId → `server.store.scope-violation`, not applied | Guard fires before applyStoreOperation; operation is NOT executed |
| broadcast-only store accepts message WITHOUT clientId | Broadcast write passes through without error |

### scope=client-only guard

| Test | Goal |
|---|---|
| client-only store rejects message WITHOUT clientId → `server.store.scope-violation`, not applied | Guard fires before applyStoreOperation; operation is NOT executed |
| client-only store accepts message WITH clientId | Per-client write passes through without error |

### Pass-through not affected

| Test | Goal |
|---|---|
| broadcast-only store passes through message for a different store id unchanged | Guard does not touch pass-through (wrong id) messages |
| client-only store passes through message without ui.store | Guard does not affect non-store messages |

### mapConfig round-trip

| Test | Goal |
|---|---|
| mapConfig preserves scope=broadcast-only | Config field survives mapConfig |
| mapConfig preserves scope=client-only | Config field survives mapConfig |
| mapConfig defaults scope to any (undefined → any OR omitted) | Missing scope field → back-compat default |

## Unit tests (`p80-store-operation-schema-validation.test.ts`)

| Test | Goal |
|---|---|
| set without value → `server.store.invalid-operation` with "requires a value" | Missing value field rejected |
| patch without path → `server.store.invalid-operation` with "requires a path" | Missing path field rejected |
| delete without path → `server.store.invalid-operation` with "requires a path" | Missing path field rejected |
| replace without value → `server.store.invalid-operation` with "requires a value" | Missing value field rejected |
| valid set (path + value) proceeds without error | Happy path: no false positives |
| valid replace (value, no path) proceeds without error | Happy path: no false positives |
| valid reset (no path/value) proceeds without error | Happy path: no false positives |
| message without ui.store is passed through unchanged | Pass-through preserved |
| message with ui.store for a different id is passed through unchanged | Pass-through preserved for wrong-id messages |

## E2E tests (`tests/e2e/nodes/behavior/ui-store.spec.ts`)

| Test | Goal |
|---|---|
| store with initial value → bound ui-text renders that value | Initial value written to liveState at startup |
| store with numeric initial value → bound ui-text renders the number | Numeric initial values round-trip correctly |
| inject message to store node → bound ui-text updates via SSE | Flow-driven store update triggers live snapshot push |
| value injected into store persists when re-navigating within session | liveState retains value across route navigation |

## E2E tests — store subPath (P131, ADR 0013)

Spec: `tests/e2e/nodes/behavior/ui-store.spec.ts` (describe block `ui-store subPath (P131)`).

| Test | Goal |
|---|---|
| store binding with subPath 'c' renders the property value 'eins' | One-level `subPath` reads a property out of an object slice instead of rendering the whole object as "?" |
| replacing the store slice updates the subPath-bound text via SSE | A flow-driven `replace` re-resolves the `subPath` and pushes the new value live |

Unit coverage: `packages/schema/test/p131-store-subpath.test.ts` (schema: `subPath` validates; `subPath.subPath` and `subPath` on non-store rejected) and `packages/renderer/test/p131-store-subpath.test.ts` (resolution: literal/numeric/dotted/dynamic paths, empty vs object slice, unresolvable → marker + one speaking error, recursion-guard backstop).

## E2E tests — store-binding editor (P132, ADR 0013)

Spec: `tests/e2e/nodes/editor/store-binding-subpath.spec.ts`. Drives the value
typedInput's `store` source in a ui-text panel.

| Test | Goal |
|---|---|
| button-first: before a store is chosen, only the 'Store auswählen' button (no path field) | Button-first rendering with the `fa fa-database` icon; the sub-path typedInput is absent until a store is picked (ADR 0013 §4) |
| after selecting a store the button becomes 'Store ändern' and the NAME (not id) shows | The resolved store **name** ("monster") shows beside the button — never the raw node id ("monsterStore"); the sub-path typedInput appears |
| the sub-path typedInput offers exactly the 11 storePath sources, string default | `valueBindingTypes({category:"storePath"})` → `str, num, routeParam, query, store, reactive, jsonata, msg, flow, global, env`, string default |
| string-type autocomplete suggests the default-slice keys (a, b, c) | Soft autocomplete derives the slice keys from the store's `initialValue` `{a,b,c}` for the `str` type |
| selecting 'c' saves subPath {kind:'literal', value:'c'} and round-trips showing the NAME | `{kind:"store", path:"monsterStore", subPath:{kind:"literal", value:"c"}}` saves and survives close/reopen; the **name** is shown on reopen |
| an unresolvable store id falls back to '<id> (bestehend)' | A deleted/unknown store id shows the `<id> (bestehend)` fallback, consistent with the other reference fields |

Unit coverage: `packages/editor/test/p132-store-subpath.test.ts` (pure default-slice key/index derivation `defaultSliceKeySuggestions` + `parseStoreDefaultSlice`; the `storePath` category 11-source set; `applyValueBinding`/`readValueBinding` carrying an optional one-level `subPath` and round-tripping it via the store-field envelope; bare-store P113 compatibility preserved).
