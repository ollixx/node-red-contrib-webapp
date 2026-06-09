---
id: P80
title: "Bugfix: Store-Operationen zur Laufzeit gegen storeOperationSchema validieren — vor applyStoreOperation safeParse, bei Fehler strukturierter Fehler `server.store.invalid-operation` mit sprechender Schema-Meldung (set/patch/delete ohne path, set/patch/replace ohne value); Pass-Through für fremde Messages unverändert. Tests + Doc-Update (stores.md „Bekannte Lücke\", ui-store.md)"
epic: nodes/ui-store
status: done
dependencies: [P15]
node: ui-store
spec: docs/nodes/state/ui-store.md
---
# P80 — Bugfix: Store-Operationen zur Laufzeit gegen storeOperationSchema validieren — vor applyStoreOperation safeParse, bei Fehler strukturierter Fehler `server.store.invalid-operation` mit sprechender Schema-Meldung (set/patch/delete ohne path, set/patch/replace ohne value); Pass-Through für fremde Messages unverändert. Tests + Doc-Update (stores.md „Bekannte Lücke", ui-store.md)

## Result

**Delivered:** Runtime store-operation schema validation: storeOperationSchema.safeParse() is now called before applyStoreOperation in the ui-store inputHandler; invalid operations (set/patch/delete without path, set/patch/replace without value, unknown op) report a structured error with code server.store.invalid-operation and the first Zod message, then call done(err) and abort without applying or sending.

**Stats:** 6 files changed; 1 new test file (p80-store-operation-schema-validation.test.ts, 9 tests); 3 existing test files updated to use valid 'replace' ops; p56 assertion updated; stores.md known-gap block replaced with error-code summary table; 376→385 tests.

**Notes:** Existing p15/p31 tests used op:'set' without path (relied on old un-validated behaviour); updated to op:'replace'. The p56 'explode' op test now expects server.store.invalid-operation instead of server.store.operation-failed because the schema rejects unknown ops first. storeOperationSchema uses .issues (ZodError) not .errors. ui-store.md was already spec-ahead and required no changes. ORCHESTRATOR INTERVENTION: the sub-agent updated unit tests but missed two E2E specs the new validation broke (it cannot reliably run Playwright in its worktree). The orchestrator's full-E2E pass on develop caught them and fixed directly: (1) tests/e2e/fixtures/p31-live-transport.flow.json emitted op:'set' with no path (now rejected) → changed to op:'replace'; (2) tests/e2e/p56-error-forwarding.spec.ts asserted the old 'ui-store operation failed' console message for an unknown op, which is now rejected earlier with the Zod message 'Invalid option: expected one of "set"|"patch"|"delete"|"replace"|"reset"' (code server.store.invalid-operation) → assertion updated. Full E2E 297 passed after the fix.


**Cost:** session a8f6eae606a35d9c3, 8m + orchestrator E2E fix
