# ui-checkbox — Test Catalogue (P97)

Per `.ai/agents/node-testing.md`: outcome-based tests only. Updated by P97.

## E2E Tests (`tests/e2e/nodes/view/ui-checkbox.spec.ts`)

| # | Test name | Goal |
|---|---|---|
| 1 | renders sl-checkbox in DOM with label text | Core render pipeline: sl-checkbox present + correct plain-string label text |
| 2 | label as literal binding renders label text in sl-checkbox | label typedInput (literal binding) resolved to text in DOM |
| 3 | disabled literal true → sl-checkbox[disabled] in browser DOM | disabled binding (literal true) produces [disabled] attribute on element |
| 4 | disabled absent → no [disabled] attribute on sl-checkbox | No spurious disabled attribute when disabled field not set |
| 5 | value literal true → sl-checkbox[checked] attribute present | value binding (literal true) → [checked] attribute on element |
| 6 | value literal false → no [checked] attribute | value binding (literal false) → no [checked] attribute |
| 7 | size='sm' → sl-checkbox[size=small] in browser DOM | size field 'sm' maps to Shoelace size="small" |
| 8 | size='lg' → sl-checkbox[size=large] in browser DOM | size field 'lg' maps to Shoelace size="large" |
| 9 | size 'md' → sl-checkbox[size=medium] in browser DOM | size field 'md' maps to Shoelace size="medium" |
| 10 | sl-change → POST /event with { event:'change', params:{ checked: bool } } | Change event emitted on user interaction (check) |
| 11 | sl-change unchecking → POST /event with checked: false | Change event emitted on user interaction (uncheck) |

## Unit Tests (`packages/runtime/test/p97-checkbox-field-extension.test.ts`)

| Group | # tests | Goal |
|---|---|---|
| mapConfig — label | 4 | literal/state/store binding + plain string preserved by mapConfig |
| mapConfig — value | 6 | literal/state/store/query/msg binding + legacy valuePath migration |
| mapConfig — disabled | 3 | literal true/state binding preserved; absent → undefined |
| mapConfig — size | 4 | sm/lg preserved; absent/empty → undefined |
| serializer — label | 3 | plain string, XSS guard, binding-resolved string in output |
| serializer — disabled | 2 | disabled:true → attribute; disabled:false → no attribute |
| serializer — size | 3 | sm→small, lg→large, absent→no size= |
| serializer — checked | 2 | value:true → checked; value:false → no checked |
