---
id: P29
title: "ADR 0003 + revert in-runtime business logic (kill submit/remove CRUD)"
epic: aspects/runtime
status: done
dependencies: [P28]
---
# P29 — ADR 0003 + revert in-runtime business logic (kill submit/remove CRUD)

## Result

**Delivered:** Removed the invented data actions and all in-runtime CRUD so the action vocabulary is interaction-only, per docs/nodes/concepts/actions.md. Dropped the submit/remove action types and the collection/keyField/draftPath/dialog fields from packages/schema (action contract + ui-action node definition), the ui-action editor HTML, and the runtime mapConfig/node-set mapping. Deleted applySubmitAction, applyRemoveAction and the submit/remove dispatch branches from nodes/webapp.js, plus the now-dead nextRecordId helper; show/hide now resolves its dialog target via the path selector only. Wrote docs/adr/0003-live-node-red-app-no-preview.md (supersedes only the transport/preview slice of ADR 0002; rendering/theming stays) and referenced it from ADR 0002's status header. The customers example's saveCustomer became an interaction-only hide (close dialog) and deleteCustomer a navigate; the example flow was regenerated via pnpm gen:example.

**Stats:** 17 files changed (3 schema/runtime src, 1 editor HTML, gen-example.js, example flow.json, 2 ADRs, actions.md, 3 unit tests, 3 e2e specs/fixtures). Unit suite: 172 tests, 0 failures. pnpm validate (roadmap+lint+test+build) green.

**Notes:** Phase scope was the teardown only — applyPreviewAction and the previewState/previewQueries simulation remain (their removal is P32). 'trigger' stays in the schema (an existing output-port mechanism, not CRUD). The form-submit EVENT name in uiEventNameSchema is unrelated to the removed submit ACTION and is retained. CRUD-via-action unit and E2E tests were rewritten to assert interaction-only behaviour (dialog closes / navigates, business data unchanged) rather than left red. actions.md gained a note reconciling its documented type set with actionTypeSchema (openDialog/closeDialog expressed via show/hide; focus/reset documented but not yet in schema — left as spec-ahead per validation step 3). E2E: touched specs (customers-crud, p22) pass; 8 unrelated pre-existing failures remain (p16d/parent-selector/editor-mount-options editor-registration timing + p21 detail-route content bug), all confirmed present on the clean pre-P29 baseline and out of this phase's scope.
