---
id: P19
title: "Editor UX polish"
epic: aspects/editor
status: done
dependencies: [P18]
---
# P19 — Editor UX polish

## Result

**Delivered:** Removed uiId field and form-tips from all 35 node HTML editors; added hr separators between field groups; fixed buildMountOptions to use node names and correct container mount values (container:<id>/<slot>); simplified identifierSchema to z.string().min(1); getAppModelResult now reports all validation issues; all 3 editor-common.js copies synced.

**Stats:** 42 files changed (35 node HTML files, 3 editor-common.js copies, webapp.js, contracts.ts, 1 E2E test); 199 unit tests pass; 18/23 Playwright tests pass (5 pre-existing p16d failures)

**Notes:** Container mount value was previously layout:<layoutId>/<slot> which caused collisions — fixed to container:<id>/<slot>. P16d E2E failures (RED.editor.cancel API issue) are pre-existing and not caused by P19. ui-button action SelectBox was already in place from a prior phase — confirmed working.
