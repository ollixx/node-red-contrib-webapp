---
id: P16b
title: "Core node expansion — feedback and status"
epic: aspects/misc
status: done
dependencies: [P12]
---
# P16b — Core node expansion — feedback and status

## Result

**Delivered:** Added 6 feedback/status nodes (ui-alert, ui-toast, ui-progress, ui-skeleton, ui-badge, ui-empty-state) with Zod schemas, runtime registry entries, Node-RED HTML+JS files, and editor type definitions.

**Stats:** 18 files changed, 12 new node files, 10 new schema/test entries, 6 new editor configs and nodeSet entries

**Notes:** ui-toast scopes to ui-app parent (no mount slot), all others are mountable. bindingSchema uses kind not binding field — corrected in tests. Editor catalog test updated to include all 6 new types.
