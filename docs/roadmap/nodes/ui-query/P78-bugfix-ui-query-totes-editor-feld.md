---
id: P78
title: "Bugfix: ui-query totes Editor-Feld `previewData` — in P32 aus Schema+Runtime entfernt, aber ui-query.html zeigt es weiterhin (Drei-Wege-Mismatch). Feld aus dem Editor entfernen + Round-Trip-Test"
epic: nodes/ui-query
status: done
dependencies: [P32]
node: ui-query
spec: docs/nodes/state/ui-query.md
---
# P78 — Bugfix: ui-query totes Editor-Feld `previewData` — in P32 aus Schema+Runtime entfernt, aber ui-query.html zeigt es weiterhin (Drei-Wege-Mismatch). Feld aus dem Editor entfernen + Round-Trip-Test

## Result

**Delivered:** Removed dead `previewData` editor field from ui-query.html (defaults object + template textarea) that lingered after P32 deleted it from schema and runtime; added E2E round-trip test asserting the field is absent and queryPath persists across save/reopen.

**Stats:** 2 files changed (+29/-3); 1 new E2E test; 297 E2E, 374 unit passing.

**Notes:** Pure editor-only fix — no schema or runtime changes needed. The three-way contract (schema/runtime/editor) is now consistent for ui-query.

**Cost:** session a80760e613787006c, 8m
