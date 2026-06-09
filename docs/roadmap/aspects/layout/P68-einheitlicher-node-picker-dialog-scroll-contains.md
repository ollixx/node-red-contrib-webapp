---
id: P68
title: "Einheitlicher Node-Picker-Dialog (Scroll + Contains-Suche über Name/ID/Typ, Default-Filter-Presets) für ALLE ui-*-Auswahlen (parents, references, mount, stores, routes, actions)"
epic: aspects/layout
status: done
dependencies: [P19]
---
# P68 — Einheitlicher Node-Picker-Dialog (Scroll + Contains-Suche über Name/ID/Typ, Default-Filter-Presets) für ALLE ui-*-Auswahlen (parents, references, mount, stores, routes, actions)

## Result

**Delivered:** One reusable node-picker dialog in resources/lib/editor-common.js for every ui-* node selection — a 'list' button injected next to each bound <select> opens an admin-UI modal (no Shoelace) with a scrollable candidate list and case-insensitive contains-search over name, id AND node type; the per-field DEFAULT filter is a pure preset (apps/routes/actions/stores). Picking writes the id back to the <select>; values stay IDs, save round-trip unchanged, zero per-node HTML churn.

**Stats:** 1 source file (resources/lib/editor-common.js, +~292 lines) + 1 new E2E spec (tests/e2e/nodes/editor/node-picker.spec.ts, 3 tests); ~5 new public exports (nodePickerMatch, nodePickerPresets, nodePickerOptionsForPreset, openNodePickerDialog, enhanceSelectWithPicker); no new node types, no schema change, no gen:example.

**Notes:** In-place <select> enhancement (enhanceSelectWithPicker) wired into installParentAppSelector + installReferenceSelectors (route/action/store) — installer signatures kept, so no node HTML edits and the bound select stays the round-trip source of truth. Open design points resolved per the phase plan: mount stays the existing slot-tree (setSelectOptionsTree), and the P60 canvas picker (RED.view.selectNodes) coexists unchanged. Editor-only UX → no schema/contract change → no gen:example. FIX during orchestration (phase/P68-fix): the initial 'stores' preset set the searchable name to store.id and collectReferenceNodes never captured the ui-store node's name, so searching a store by its canvas name returned 0 rows; fixed by capturing name:node.name for ui-store and using it as the searchable name + label prefix (id still searchable, id save round-trip unchanged). ORCHESTRATOR VERIFICATION: pnpm validate green (schema/runtime; 294 unit tests, lint clean, build clean). node-picker.spec.ts 3/3 pass. The full-suite editor-registration failures (p12/p13/p15/parent-selector, 9-14 across runs) are the SAME PRE-EXISTING shared-server flakiness documented in P66 — proven NOT P68-caused: (a) baseline with pre-P68 editor-common.js fails MORE (14) than with P68 (9-10); (b) those 4 editor specs pass 13/13 in isolation and 16/16 with the picker spec running first (picker does not pollute). Single shared Node-RED webServer (workers:1) flakes by accumulated state late in the ~6-min run.


**Cost:** session <orchestrator>, ~40m (incl. 2 worktree sub-agents: impl ~7m + fix ~9m, 2 merges, baseline+P68 full-E2E comparison and flakiness diagnosis); impl/fix token totals auto-logged to .ai/agent-runs.jsonl
