---
id: P16c
title: "Core node expansion — navigation and structure"
epic: aspects/misc
status: done
dependencies: [P12]
---
# P16c — Core node expansion — navigation and structure

## Result

**Delivered:** Added 6 navigation/structure nodes: ui-tabs, ui-accordion, ui-breadcrumb, ui-menu, ui-pagination, ui-stepper — schemas, editor HTML+JS, webapp.js registry entries, and unit tests.

**Stats:** 17 files changed, 12 new node files, 10 new schema tests (44 total), all 168 tests passing

**Notes:** Breadcrumb and menu use state bindings via itemsPath for dynamic items; tabs/accordion/stepper use JSON string fields in the editor for static item definitions. No docs node spec files existed so none were added.
