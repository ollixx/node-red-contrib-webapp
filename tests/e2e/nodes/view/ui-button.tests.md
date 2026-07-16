# ui-button — Test Catalogue (P96)

Fresh tests written per `.ai/agents/node-testing.md`. Replaces P43 render-only tests and P44 event test.

P96 context: the phase found that ui-button's render pipeline was already correct (components-filter,
P16X_KIND_MAP, componentKindSchema, renderer.ts, and serializer all handle "button" consistently).
These tests LOCK that correctness in so a regression in any pipeline layer is caught immediately.

**Orchestrator note**: after merging `phase/P96`, delete
`tests/e2e/nodes/view/ui-button-events.spec.ts` from develop — its single click test is now
covered by `ui-button.spec.ts`.

## Unit tests (`packages/runtime/test/p96-button-render-pipeline.test.ts`)

All tests are serializer-based (outcome-based; turn RED if the feature is removed).

### Core render pipeline

| Test | Goal |
|---|---|
| kind='button' → renders `<sl-button>` (not undefined/empty) | Regression guard for "renders NOTHING" |
| label text appears inside sl-button as the default slot | Label is slot content, not attribute |
| label is HTML-escaped (no XSS via label text) | Security: label injection guard |
| enabled button is always an event source (data-webapp-source + data-webapp-event) | Every enabled button is interactive |
| event source id matches the component id | Correct wiring of sourceId |

### Variant serialization

| Test | Goal |
|---|---|
| variant='primary' → sl-button[variant=primary] | Primary variant reaches Shoelace |
| variant='danger' → sl-button[variant=danger] | Danger variant reaches Shoelace |
| variant='ghost' → sl-button[variant=default] (ghost maps to Shoelace default) | Many-to-one mapping documented |
| no variant → sl-button[variant=default] (Shoelace default fallback) | Absent variant uses fallback |

### Size serialization (sm/md/lg → small/medium/large)

| Test | Goal |
|---|---|
| size='sm' → size='small' on sl-button | Semantic sm → Shoelace small |
| size='md' → size='medium' on sl-button | Semantic md → Shoelace medium |
| size='lg' → size='large' on sl-button | Semantic lg → Shoelace large |
| no size → no size attribute on sl-button | Absent size emits no attr |

### Outline flag

| Test | Goal |
|---|---|
| outline=true → outline boolean attribute present | Outline renders correctly |
| outline=false → no outline attribute | False/absent outline emits nothing |
| outline absent → no outline attribute | Default: no outline |

### Disabled rendering

| Test | Goal |
|---|---|
| disabled=true → sl-button[disabled] + NOT an event source | Disabled button has correct attrs and no click |
| disabled=false → no disabled attribute, still an event source | Enabled button emits events |

### Link-mode serialization

| Test | Goal |
|---|---|
| default "button" mode → no href, click-dispatch event source | Default is event source |
| "url" mode with href → sl-button[href] renders a real hyperlink | URL mode renders `<a>` via Shoelace |
| "url" mode href is HTML-escaped | Security: href injection guard |
| "navigate" mode → data-webapp-navigate carries route AND click source | Navigate mode: in-app navigation |

### Icon prefix slot

| Test | Goal |
|---|---|
| icon {library,name} → sl-icon[slot=prefix] rendered before the label | Icon appears in correct slot |
| icon renders as sl-icon with name attribute | Icon name attribute emitted |
| no icon → no prefix slot in output | Absent icon produces clean output |

## E2E tests (`tests/e2e/nodes/view/ui-button.spec.ts`)

All tests run against the live Node-RED E2E instance.

### Core render pipeline

| Test | Goal |
|---|---|
| renders sl-button in DOM with label text | End-to-end: sl-button with label is visible in browser |
| default state (no label) → sl-button label falls back to the node id | Node-id fallback for the label is rendered when no label is set |

### Variant

| Test | Goal |
|---|---|
| variant='primary' → sl-button[variant=primary] in browser DOM | Variant reaches browser |
| variant='danger' → sl-button[variant=danger] in browser DOM | Danger variant in browser |

### Size

| Test | Goal |
|---|---|
| size='sm' → sl-button[size=small] in browser DOM | Size reaches browser (Shoelace attribute) |
| size='lg' → sl-button[size=large] in browser DOM | Large size in browser |

### Outline

| Test | Goal |
|---|---|
| outline=true → sl-button has outline attribute in browser DOM | Outline attribute in browser |

### Disabled

| Test | Goal |
|---|---|
| disabled literal true → sl-button[disabled] in browser DOM | Disabled attr reaches browser |
| disabled=false → sl-button has NO disabled attribute | Enabled has no disabled attr |

### Link mode

| Test | Goal |
|---|---|
| linkMode='url' with href → sl-button renders as hyperlink with href attribute | URL mode in browser |

### Click event

| Test | Goal |
|---|---|
| click on sl-button → POST /event with event='click' and sourceId | Click event dispatched to flow |
| disabled button does NOT emit click event when clicked | Disabled button does not fire |
