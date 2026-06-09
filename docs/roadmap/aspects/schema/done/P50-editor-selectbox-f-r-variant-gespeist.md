---
id: P50
title: "Editor-SelectBox für `variant` — gespeist aus dem Schema-Vokabular"
epic: aspects/schema
status: done
dependencies: [P49, P49a]
---
# P50 — Editor-SelectBox für `variant` — gespeist aus dem Schema-Vokabular

## Result

**Delivered:** Added installVariantSelectBox(kind) to editor-common.js and wired it into all 4 nodes with TRUE semantic variant fields (ui-button, ui-text, ui-input, ui-container), removing their hand-rolled <select> option lists from templates.

**Stats:** 8 files changed, 252 insertions, 46 deletions; 6 new E2E tests (5 editor SelectBox + 1 render round-trip); all 219 unit tests + 34 editor E2E tests green

**Notes:** buildFieldRowMarkup extended for type='select' with options array; COMPONENT_VARIANT_VOCABULARY and COMPONENT_VARIANT_DEFAULT embedded in editor-common.js (mirrors schema constants, must stay in sync manually); worktree was again at stale db4f4ff commit, fixed with git merge --allow-unrelated-histories; .node-red-dev symlinked for E2E; full 232-test suite gets SIGKILL'd on this machine after ~5min so validated in targeted batches instead.

**Cost:** session a959dcd94220e4990, 55m
