---
id: P90
title: "ui-alert Icon-Feld + Icon-Logik (VORGEHENSENTSCHEIDUNG) — Option 1: Icon-Auswahl nach Severity + „ohne Icon\", Default = Severity-Wert. Option 2: Alert mit 4 Slots"
epic: nodes/ui-alert
status: done
dependencies: [P69]
node: ui-alert
spec: docs/nodes/feedback/ui-alert.md
tests: tests/e2e/nodes/view/ui-alert.tests.md
---
# P90 — ui-alert Icon-Feld + Icon-Logik (VORGEHENSENTSCHEIDUNG) — Option 1: Icon-Auswahl nach Severity + „ohne Icon", Default = Severity-Wert. Option 2: Alert mit 4 Slots

## Result

**Delivered:** Added `icon` field to ui-alert (Option 1: severity-derived auto icon + explicit override); rendered via Shoelace `icon` slot in webapp-serializer; wired through schema, mapConfig, node-set, and editor SelectBox.

**Stats:** 9 files changed; 16 unit tests (mapConfig + serializer); 11 E2E outcome tests replacing P43 presence-only tests; 1 test catalogue .md added

**Notes:** Chose Option 1 (simpler, self-contained) over Option 2 (slot infrastructure would touch mount/child architecture). Default when field absent = no icon (backward-compat).

**Cost:** session afe669c9a7b58ab32, 13m
