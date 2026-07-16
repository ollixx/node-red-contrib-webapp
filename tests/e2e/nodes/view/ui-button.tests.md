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
| default-configured button renders its label text (sl-button, not empty) | Der gerenderte `sl-button` trägt seinen Label-Text (Default „Button"); rot wenn das Label-Binding das Element nicht erreicht |

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

## P236 conformance additions (`tests/e2e/nodes/view/ui-button.spec.ts`)

Node-conformance pass. Every assertion is derived from the mapConfig `ui-button`
block (`nodes/webapp.js`) + the serializer `kind === "button"` branch
(`resources/lib/webapp-serializer.js`) and confirmed against the live served HTML.

### Working features (green, measured)

| Test | Goal / derived outcome |
|---|---|
| store-bound label renders resolved value + updates via SSE | `bind.label` → resolvedProps.label → button slot text; store replace re-renders (LiveLabel → ChangedLabel) |
| icon {library,name} → `<sl-icon slot="prefix" name="gear">` before the label | Icon in the button's prefix slot (HTML regex + measured DOM count) |
| store-bound href (linkMode=url) → sl-button[href] | Dynamic href → `bind.href` → resolvedProps.href → `sl-button[href]` hyperlink |

### Known gaps — asserted as REAL current behaviour (DISCREPANCY, flip on fix)

| Test | Real behaviour asserted | Root cause |
|---|---|---|
| bound `color` emits NO colour style on the button | Button renders, no `--color`/inline colour | `color` is N/A for a button (colour is `variant`; editor `color:false`); neither mapConfig nor serializer touches button colour |
| store-bound `visible=false` STILL renders the button | Render-gate does NOT fire | `ui-button` mapConfig never wires `visible → visibleIf` (unlike p16Kind nodes) — genuine gap; editor DOES offer `visible` |
| `msg.payload` does NOT change the rendered label | Label stays `OrigLabel` after inject | `computeLiveViewPatch` (nodes/webapp.js) omits "label" from carried snapshot fields; proven with a ui-text control on the same inject |
