---
id: P64
title: "ui-dialog — nativer <sl-dialog> + First-class Close-Button (closable-Property, onClose-Emission + State-Sync, Dialog-Layout-Preset)"
epic: nodes/ui-dialog
status: done
dependencies: [P63]
node: ui-dialog
spec: docs/nodes/structure/ui-dialog.md
---
# P64 — ui-dialog — nativer <sl-dialog> + First-class Close-Button (closable-Property, onClose-Emission + State-Sync, Dialog-Layout-Preset)

## Result

**Delivered:** ui-dialog now renders as a native Shoelace <sl-dialog> (native X / ESC / overlay dismissal, focus-trap, a11y) with a first-class closable property and a new 'dialog' layout preset (header / header-actions / content / footer → native slots). Native dismissal emits onClose on the dialog's out-port AND authoritatively sets ui.dialogs.<id>.open=false + pushes a snapshot; the hard-coded closeCustomerEditor/cancelCustomerButton close-link, findDialogCloseAction, and bespoke sl-card dialog chrome are removed. dispatchClientEvent gained positional multi-event out-port routing (events.indexOf(event)).

**Stats:** 24 files changed (3 new test files); +18 unit tests (schema 143→152, renderer 12→14, runtime 267→276 incl. 9 P64 tests); 1 new layout preset; E2E specs updated/added across 6 spec files. E2E 264 passed / 0 failed (orchestrator main-checkout after rebuild); pnpm validate green.

**Notes:** closable defaults to true everywhere (schema, contracts, mapConfig, editor checkbox checked); closable:false → native no-header (removes X + title, accepted). Server/client dialog markup parity (P26) preserved — both call the shared serializer with the unmodified snapshot dialog. Factored writeDialogOpenState/pushSnapshotToTargets out of pushActionCommandToClients. Old .webapp-dialog overlay/card/head CSS removed (Shoelace owns chrome); .webapp-dialog class now sits on the sl-dialog so existing .webapp-dialog visibility selectors still match. Scope boundary: removed closeCustomerEditor from gen-example/flow.json (P64 scope) but intentionally KEPT it in the schema AppModel test fixture (fixtures.ts) to avoid churning renderer/runtime fixture tests. Orchestrator note: dist is gitignored — a first E2E pass on stale P63 dist produced 6 "cannot find layout 'dialog'" failures; after `pnpm build` on develop all 264 E2E passed.


**Cost:** session c242a981-027e-462b-9583-6aede9c2291d, ~28m; orchestrator main-checkout rebuild + E2E (264) + validate
