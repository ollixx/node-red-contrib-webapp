---
id: P67
title: "ui-alert — 'Message Path' durch typedInput (alle Typen + neue Binding-Art 'store' mit Store-Picker via P68) ersetzen; title ebenfalls typedInput"
epic: nodes/ui-alert
status: done
dependencies: [P20b, P68]
node: ui-alert
spec: docs/nodes/feedback/ui-alert.md
tests: tests/e2e/nodes/view/ui-alert.tests.md
---
# P67 — ui-alert — 'Message Path' durch typedInput (alle Typen + neue Binding-Art 'store' mit Store-Picker via P68) ersetzen; title ebenfalls typedInput

## Result

**Delivered:** ui-alert's plain-text messagePath editor field replaced by typedInputs on message and title supporting all binding kinds (literal/state/query/routeParam/msg/flow/global/jsonata/env) plus a NEW reusable `store` binding kind that references a ui-store by id and resolves at runtime via its statePath (robust to statePath renames); the store typedInput type reuses the P68 node-picker (stores preset); legacy messagePath stays back-compat (→ state binding).

**Stats:** 16 source/doc files + 2 generated examples + 1 new E2E spec (3 tests); +14 unit tests (schema 4, renderer 3, editor 7); full E2E 273 passed / 0 failed.

**Notes:** Schema: `store` added to bindingSchema kind enum (path = ui-store id; superRefine already requires a path for non-literal kinds); ui-alert.title string→bindingSchema.optional(). Renderer: storePaths map (id→statePath) built once from integration.stores; resolveBinding `store` case → state value. webapp.js mapConfig: getBinding for message+title; messagePath→state back-compat fallback kept. packages/editor: findUnknownStoreBindings() structure-view diagnostic (store binding must reference an existing ui-store); added storeIds to CompiledRegistrySnapshot. editor-common.js: storeTypedInputType()/bindingTypedInputTypes() helpers; store type expand button opens the existing P68 openNodePickerDialog("stores"). ORCHESTRATOR INTERVENTION: the implementation sub-agent could not run Playwright in its worktree and TWO successive blind fix sub-agents misdiagnosed the resulting E2E-only failures as test-only (they were not). Real bugs found and fixed by the orchestrator directly on the integration branch (fix commit on phase/P65-work): (1) message/title typedInputs were bound to #node-input-message/-title while the binding OBJECT was stored in the SAME message/title defaults — Node-RED's post-oneditsave defaults auto-read overwrote node.message with the raw typedInput value (e.g. "draftStore" instead of {kind:"store", path:"draftStore"}); fixed by mirroring ui-text's split — typedInputs moved to messageBinding/titleBinding fields, message/title kept as object-storage defaults with NO #node-input-* element so the auto-read can't clobber them (mapConfig still reads message/title). (2) legacy messagePath read back as "literal" not "state": the empty-literal message default masked the messagePath fallback AND messagePath was not in defaults so it never loaded into oneditprepare; fixed by preferring messagePath when message is an empty literal and declaring messagePath as a DOM-less default. The P67 E2E spec was updated to drive the *Binding typedInput fields while still asserting the stored message/title objects. gen:example unaffected by the editor-only fix; .node-red-dev/flows.json never touched.


**Cost:** session <orchestrator>, impl sub-agent ~23m + 2 blind fix sub-agents (~14m each) + orchestrator diagnosis/fix/verify; token totals auto-logged to .ai/agent-runs.jsonl
