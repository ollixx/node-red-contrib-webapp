---
id: P16a
title: "Core node expansion — input controls"
epic: aspects/misc
status: done
dependencies: [P12]
---
# P16a — Core node expansion — input controls

## Result

**Delivered:** Added 7 new input control nodes (ui-select, ui-checkbox, ui-radio, ui-switch, ui-textarea, ui-datepicker, ui-slider) with schema definitions, webapp.js mapConfig entries, Node-RED JS+HTML editor files, and editor package definitions.

**Stats:** 18 new unit tests, 3 new HTML editor files (textarea/datepicker/slider were missing), editor nodeSet expanded from 12 to 19 types, fixed pre-existing lint/build errors in schema/runtime/editor packages

**Notes:** Schema and webapp.js runtime entries were largely pre-existing from a partial earlier implementation. Main work was completing the HTML editors, adding editor package type definitions and nodeSet entries, expanding MountableEditorSourceNode in structure-view.ts, and writing unit tests. Fixed pre-existing unused-import lint errors and stale `source` field on ui-query in fixtures/editor.
