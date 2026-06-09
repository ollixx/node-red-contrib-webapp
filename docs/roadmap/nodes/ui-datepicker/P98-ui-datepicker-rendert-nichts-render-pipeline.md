---
id: P98
title: "ui-datepicker — 🔴 rendert NICHTS (Render-Pipeline prüfen, vgl. P96) + „Value Path\" und „Label\" als typedInput mit allen sinnvollen Binding-Typen. Übrige Felder vorerst unverändert (dynamisch später). Docs anpassen"
epic: nodes/ui-datepicker
status: done
dependencies: [P16a, P67]
node: ui-datepicker
spec: docs/nodes/input/ui-datepicker.md
tests: tests/e2e/nodes/view/ui-datepicker.tests.md
---
# P98 — ui-datepicker — 🔴 rendert NICHTS (Render-Pipeline prüfen, vgl. P96) + „Value Path" und „Label" als typedInput mit allen sinnvollen Binding-Typen. Übrige Felder vorerst unverändert (dynamisch später). Docs anpassen

## Result

**Delivered:** ui-datepicker render pipeline verified (sl-input[type=date] was already correct) + label and value fields upgraded to full typedInput with all binding kinds (literal/state/store/query/routeParam/msg/flow/global/jsonata/env); legacy valuePath migrated transparently; docs updated.

**Stats:** 8 files changed; 764 unit tests (all green); 26 new unit tests (p98-datepicker-field-extension.test.ts); fresh E2E spec replacing P44+P73 (9 E2E tests); test catalogue .md added; old ui-datepicker-p73.spec.ts deleted.

**Notes:** Render pipeline was already correct (same as P96/ui-button); no fix needed, regression guard tests lock it in. Schema uses z.union([bindingSchema, z.string()]) for back-compat with legacy plain string labels.

**Cost:** session agent-a7cda6f4171b5c361, 20m
