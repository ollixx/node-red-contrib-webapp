---
id: P57
title: "ui-log Knoten — Fehler/Log als konfigurierbares UI-Element"
epic: nodes/ui-log
status: done
dependencies: [P56]
node: ui-log
spec: docs/nodes/feedback/ui-log.md
---
# P57 — ui-log Knoten — Fehler/Log als konfigurierbares UI-Element

## Result

**Delivered:** Implemented the ui-log node — a persistent, inspectable error/log display that mounts into any slot, subscribes to the SSE 'error' channel automatically, and renders structured ADR 0006 entries as a live-updating Shoelace sl-details panel.

**Stats:** 19 files changed, 661 insertions, 13 deletions; 5 new E2E tests (all pass), 11 new unit tests (all pass); 247 E2E total, 240 unit tests total — all green.

**Notes:** Renderer kind union and uiComponentKindSchema were implicit requirements not covered by the /node-red-node skill pattern — both needed updating for the component to render (discovered via E2E failure loop). Fixed and friction-logged. gen-node-examples entry added. The node is display-only (0 inputs, 0 outputs); client-side appendLogEntry() handles the live SSE→DOM update with severity filtering and maxEntries capping.

**Cost:** session claude-sonnet-4-6/2026-06-06, 42m
