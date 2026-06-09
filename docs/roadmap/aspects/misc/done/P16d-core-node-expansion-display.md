---
id: P16d
title: "Core node expansion — display"
epic: aspects/misc
status: done
dependencies: [P12]
---
# P16d — Core node expansion — display

## Result

**Delivered:** Added 5 display nodes: ui-image, ui-icon, ui-list, ui-avatar, ui-divider — schemas, editor HTML+JS, webapp.js registry entries, editor package definitions, and unit tests.

**Stats:** 18 new files, 10 new schema unit tests (54 total schema tests), 5 new E2E tests, all 178 tests passing

**Notes:** ui-image uses fallback field (doc uses fallbackSrc — minor naming divergence). ui-icon size accepts string for flexibility beyond enum. ui-list items accepts both static array and state binding. E2E fixture deploys all 5 nodes and verifies mount selector and name default.
