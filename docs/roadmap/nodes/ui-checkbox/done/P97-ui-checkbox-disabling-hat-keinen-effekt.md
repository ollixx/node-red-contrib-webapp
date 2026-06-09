---
id: P97
title: "ui-checkbox — disabling hat keinen Effekt (im Beispiel) → fixen; size-Feld ergänzen; „Value Path\" und „Label\" als typedInput mit allen sinnvollen Binding-Typen. Docs anpassen"
epic: nodes/ui-checkbox
status: done
dependencies: [P16a, P67]
node: ui-checkbox
spec: docs/nodes/input/ui-checkbox.md
tests: tests/e2e/nodes/view/ui-checkbox.tests.md
---
# P97 — ui-checkbox — disabling hat keinen Effekt (im Beispiel) → fixen; size-Feld ergänzen; „Value Path" und „Label" als typedInput mit allen sinnvollen Binding-Typen. Docs anpassen

## Result

**Delivered:** Fixed disabled having no effect by exposing a disabledBinding typedInput; converted label and value/valuePath to full typedInput bindings (all binding kinds); added size field (xs/sm/md/lg/xl); schema updated (label as union[binding,string], size enum); docs updated.

**Stats:** 9 files changed; 27 new unit tests (p97-checkbox-field-extension.test.ts); 11 fresh E2E tests replacing P44; test catalogue .md added; 738 unit tests + 359 E2E tests all green.

**Notes:** Backward compat: legacy plain-string label and valuePath plain-state-path both preserved by mapConfig. Shoelace reflects size=medium by default as DOM attribute.

**Cost:** session aaa297008f39efc5c, 30m
