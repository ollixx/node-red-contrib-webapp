# ui-text — Test Catalogue (P111)

Tests written per `.ai/agents/node-testing.md`. P111 split the old `variant`
field into two orthogonal axes — `style` (typographic role → semantic HTML
element) and `variant` (semantic colour) — and removed the `size` field. Legacy
`variant: "<role>"` configs are migrated onto the style axis at runtime.

## Unit tests

### `packages/schema/test/p49-variant-vocabulary.test.ts`

| Test | Goal |
|---|---|
| TEXT_STYLES / TEXT_COLOR_VARIANTS are non-empty | both vocabularies exported and populated |
| TEXT_STYLES contains heading-1/2, body, code; NOT muted | role axis holds typographic roles only |
| TEXT_COLOR_VARIANTS contains default, muted, danger | colour axis holds the semantic palette (muted crossed over) |
| COMPONENT_VARIANT_VOCABULARY.text === TEXT_COLOR_VARIANTS | ui-text `variant` resolves to the colour vocabulary |
| ui-text accepts style:heading-2 + variant:danger | both axes validate together |
| ui-text rejects variant:heading-2 (legacy role in colour field) | role value no longer valid as a colour |
| ui-text rejects style:bogus | unknown role rejected |

### `packages/schema/test/schema.test.ts`

| Test | Goal |
|---|---|
| ui-text removed from the three-size node list | ui-text no longer has a `size` field (P111) |

### `packages/runtime/test/p49-variant-serializer.test.ts`

| Test | Goal |
|---|---|
| style 'heading-2' → `<h2>` + webapp-text--heading-2 | role maps onto a semantic element + role class |
| variant 'danger' → webapp-text--color-danger on `<p>` | colour maps onto the colour class |

### `packages/runtime/test/p104-central-value-rendering.test.ts`

| Test | Goal |
|---|---|
| innerText extraction is tag-agnostic | central-value tests read any text element tag (default `<p>`) |

## Unit tests — value sources (P111 Tranche 2)

### `packages/renderer/test/renderer.test.ts`

| Test | Goal |
|---|---|
| text node with a msg binding → '' (empty, not '?') | Message-mode binding renders empty until pushed |

### `packages/runtime/test/p111-text-value-sources.test.ts`

| Test | Goal |
|---|---|
| flow binding → literal from flow context | server-side resolution reads flow context |
| global binding → literal from global context | server-side resolution reads global context |
| env binding → literal via evaluateNodeProperty | server-side resolution reads env |
| unresolved context → literal fallback (→ '?') | missing context value degrades to fallback |
| msg binding left untouched | Message mode is not server-resolved |
| literal/state/store left untouched | reactive/literal bindings pass through |
| no-op returns the same object | no needless copy when nothing to resolve |
| mapConfig passes store/msg/flow/global/env through | editor→definition mapping preserves the new kinds |

## E2E tests (`tests/e2e/nodes/view/ui-text.spec.ts`)

| Test | Goal |
|---|---|
| text content renders inside the component | literal value rendered in browser |
| binding to store value renders the store value | state binding resolved in browser |
| renders inside webapp-text element | default style renders the webapp-text element |
| style 'heading-1' → `<h1>` with role class | role renders the matching semantic tag in the browser |
| style 'code' → `<code>` element | code role renders monospace `<code>` |
| variant 'danger' → webapp-text--color-danger | colour class present in browser DOM |
| legacy variant='heading-2' migrates to `<h2>` | back-compat: old role-in-variant still renders as a heading |
| store binding renders the bound store value | `store` value source resolves in the browser |
| msg binding (payload): empty until a message is pushed | empty before push; updates + SSE-shared after inject |
| msg binding respects a nested path (payload.label) | standard msg binding reads the configured message property, not just payload |
