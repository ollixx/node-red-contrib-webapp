# ui-datepicker test catalogue

Fresh tests written in P98 per `.ai/agents/node-testing.md`.
Replaces P44 (presence-only) and P73 (mode-mapping-only) tests.

## Unit tests (`packages/runtime/test/p98-datepicker-field-extension.test.ts`)

| Test | Goal |
|---|---|
| Render pipeline: sl-input[type=date] with label | Regression guard — ensures the complete serializer path produces `<sl-input type="date" label="...">` |
| mode=datetime → type=datetime-local | Serializer maps `mode` correctly for date+time input |
| mode=time → type=time | Serializer maps `mode` correctly for time-only input |
| value rendered as value attribute | Serializer emits `value="..."` attribute |
| disabled:true → disabled attribute | Serializer emits ` disabled` attribute when `disabled=true` |
| disabled:false → no disabled attribute | Serializer does NOT emit disabled when `disabled=false` |
| label XSS guard | Label string is HTML-escaped in output |
| label resolved from binding appears in output | Resolved binding string reaches the label attribute |
| mapConfig: label as literal/state/store/msg binding | Binding objects pass through mapConfig unchanged |
| mapConfig: label as plain string (legacy) | Plain string label preserved for back-compat |
| mapConfig: value literal/state/store/query/msg binding | All binding kinds preserved by mapConfig |
| mapConfig: legacy valuePath → state binding | `valuePath` string migrated to `{ kind: "state", path }` |
| mapConfig: disabled literal/state/absent | Disabled binding preserved; absent → undefined |
| mapConfig: mode date/datetime/time/absent | Mode enum preserved; absent → undefined |

## E2E tests (`tests/e2e/nodes/view/ui-datepicker.spec.ts`)

| Test | Goal |
|---|---|
| renders sl-input[type=date] with label attribute — regression guard | Core render pipeline: sl-input visible with correct type and label in browser DOM |
| mode='date' → sl-input[type=date] | mode field maps correctly to HTML input type |
| mode='datetime' → sl-input[type=datetime-local] | datetime mode renders correct type attribute |
| mode='time' → sl-input[type=time] | time mode renders correct type attribute |
| value literal binding renders as value attribute | Literal date string appears as value attr on sl-input |
| disabled literal true → sl-input[disabled] | Disabled attribute present in browser DOM |
| disabled absent → no [disabled] attribute | No disabled attribute when not set |
| label as literal binding → sl-input label attribute matches | Label binding resolves to correct label attribute |
| sl-change → POST /event with value param | change event dispatched with ISO-8601 date string |

## Coverage notes

- `msg.payload → value` update is covered by `p82-input-nodes-behaviour.test.ts`.
- show/hide/enable/disable verbs are covered by `ui-action-verbs.spec.ts` (cross-cutting).
- state binding for `value` and `label` is covered by unit tests above.
