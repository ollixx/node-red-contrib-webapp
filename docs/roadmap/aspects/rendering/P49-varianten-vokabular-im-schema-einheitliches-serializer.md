---
id: P49
title: "Varianten-Vokabular im Schema + einheitliches Serializer-Mapping"
epic: aspects/rendering
status: done
dependencies: [P48]
---
# P49 — Varianten-Vokabular im Schema + einheitliches Serializer-Mapping

## Result

**Delivered:** Codified a fixed, portable per-node variant vocabulary as exported schema constants (BUTTON/TEXT/CONTAINER/INPUT/SEVERITY_VARIANTS), added optional variant fields to the component schemas, untangled display-types into a separate displayType field, and routed all variant rendering through one variant→Shoelace mapping layer in the serializer.

**Stats:** ~10 files; +16 P49 unit tests (schema 9 vocabulary + runtime 7 serializer); 329 unit + variant E2E green; theming.md + 6 per-node docs updated.

**Notes:** Implementation (constants, fields, displayType split, serializer mapping, unit tests) was committed by an earlier session (be4d417/c0cb518/f633eba) which then left the phase in_progress and pivoted to roadmap planning. This finishing session completed the open deliverables and the close-out: theming.md rewritten authoritatively (per-node vocabularies pointing at the schema constants, the many-to-one rule, and the "backends never add variants" rule, plus a variant-vs-displayType table); per-node spec docs (ui-button, ui-text, ui-container, ui-input, ui-badge, ui-alert) now list variant values + defaults. Validation: pnpm build green, 329 unit tests green (incl. p49-variant-vocabulary 9 + p49-variant-serializer 7), variant E2E green (ui-button render, ui-badge severity success, ui-alert severity error→danger). TECH-DEBT (logged in friction-log): BADGE_VARIANTS/ALERT_VARIANTS are exported as SEVERITY_VARIANTS (primary|success|warning|danger|neutral|info) but the actual ui-badge/ui-alert `severity` schema field still validates the LEGACY enum (default|info|warning|error|success). The serializer normalises both (default→neutral, error→danger, info→primary) so rendering is correct, but the exported vocabulary and the field enum diverge — reconcile in a follow-up (would touch examples using severity:"info"). Display types parked under displayType for ui-progress/ui-avatar/ui-badge/ui-menu and are intentionally excluded from the variant vocabulary (so P50's SelectBox shows only true variants).


**Cost:** session 728c734d-2606-41ba-8087-6aa9075d2235, 2026-06-06T16:51Z → 2026-06-06T17:0XZ (finishing session; impl by a0ef64cc earlier)
