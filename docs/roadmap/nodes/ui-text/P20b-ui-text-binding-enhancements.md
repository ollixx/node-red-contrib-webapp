---
id: P20b
title: "ui-text binding enhancements"
epic: nodes/ui-text
status: done
dependencies: [P20a]
node: ui-text
spec: docs/nodes/display/ui-text.md
---
# P20b — ui-text binding enhancements

## Result

**Delivered:** Extended bindingSchema with msg/flow/global/jsonata/env kinds; ui-text editor adds all five as typed-input options with query path validation (dot-bracket regex); resolveBinding handles all new kinds; editor-common.js updated; docs/nodes/display/ui-text.md updated with Query path syntax section and new binding types

**Stats:** 6 files changed, 8 new schema unit tests, 208 total tests passing

**Notes:** doc path is docs/nodes/display/ui-text.md (not view/ as in roadmap — display/ is the actual category). Pre-existing E2E failures (P11b/P12/P13/P15/P16d) are unrelated to P20b changes.
