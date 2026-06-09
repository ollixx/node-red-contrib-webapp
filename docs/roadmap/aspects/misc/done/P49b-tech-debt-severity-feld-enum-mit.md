---
id: P49b
title: "Tech-Debt: severity-Feld-Enum mit SEVERITY_VARIANTS abgleichen"
epic: aspects/misc
status: done
dependencies: [P49]
---
# P49b — Tech-Debt: severity-Feld-Enum mit SEVERITY_VARIANTS abgleichen

## Result

**Delivered:** Unified the severity field on ui-badge, ui-alert, and ui-toast to use exactly the SEVERITY_VARIANTS set (primary|success|warning|danger|neutral|info); removed legacy-only values 'error' and 'default' from the schema enum, leaving graceful fallback mappings in the serializer for pre-P49b deployed flows.

**Stats:** 11 files changed, 145 insertions, 23 deletions; 7 new unit tests added (schema p49-variant-vocabulary.test.ts); 221 E2E tests pass, 111 schema tests pass

**Notes:** Legacy values 'error' and 'default' kept in SEVERITY_TO_SHOELACE in the serializer as graceful fallbacks (maps error→danger, default→neutral) for any deployed flow configs pre-dating P49b — they are rejected at authoring time by the schema but never crash the renderer. ui-badge default changed from 'default' to 'neutral' in editor HTML. ui-toast severity also unified (was a separate scope item in the roadmap). Editor TypeScript interfaces in packages/editor/src/nodes.ts updated to match.

**Cost:** session a8fa63a259f0112b1, 11m
