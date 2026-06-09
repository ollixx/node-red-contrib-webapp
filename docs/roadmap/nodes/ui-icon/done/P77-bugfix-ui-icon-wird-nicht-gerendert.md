---
id: P77
title: "Bugfix: ui-icon wird nicht gerendert — aus components-Filter ausgeschlossen (webapp.js ~1654), erzeugt kein DOM. Rendering aktivieren (Adapter kind \"icon\"); mit P69 koordinieren (Icon-System baut darauf auf)"
epic: nodes/ui-icon
status: done
dependencies: [P63]
node: ui-icon
spec: docs/nodes/display/ui-icon.md
---
# P77 — Bugfix: ui-icon wird nicht gerendert — aus components-Filter ausgeschlossen (webapp.js ~1654), erzeugt kein DOM. Rendering aktivieren (Adapter kind "icon"); mit P69 koordinieren (Icon-System baut darauf auf)

## Result

**Delivered:** Superseded by P69. The icon system added the renderer/serializer kind "icon" and removed ui-icon from the components exclusion filter so it now produces sl-icon DOM — exactly this bug's fix. Covered by the committed regression test packages/runtime/test/p69-icon-render.test.ts.

**Stats:** No separate implementation — folded into P69 (the phase title explicitly called for coordinating with P69).

**Notes:** Closed as superseded by the orchestrator without a dedicated sub-agent: P69's sub-agent verified ui-icon rendering with a committed test, and P77 had no remaining deliverable. See P69 archive entry.

**Cost:** n/a — folded into P69
