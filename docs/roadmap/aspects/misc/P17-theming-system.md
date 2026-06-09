---
id: P17
title: "Theming system"
epic: aspects/misc
status: done
dependencies: [P16a, P16b, P16c, P16d]
---
# P17 — Theming system

## Result

**Delivered:** Added designTokensSchema to ui-app with 26 token fields mapping to --wa-* CSS custom properties; added buildDesignTokenCss() helper; added variant field (enum-validated) to all 11 view node types; created docs/theming.md with full token table, variant class contract, webapp-default backend spec, and community backend extension interface.

**Stats:** 4 files changed, 510 insertions; 17 new tests in theming.test.ts; all 71 schema tests + 110 runtime + 10 editor + 4 renderer tests passing

**Notes:** ui-text already had a string variant (open-ended); P16b/c/d nodes already had variant fields where appropriate — those were left intact. buildDesignTokenCss is exported from packages/schema for use by the runtime/renderer. Playwright validation skipped per task instructions (only pnpm test + pnpm validate required).
