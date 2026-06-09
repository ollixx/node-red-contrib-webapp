---
id: P92
title: "ui-badge Felder-Rework — displayType-Werte square/rounded/pill; „Max\"-Feld ENTFERNEN (kein Countdown); „pulsating\"-Checkbox + Warnung wenn Backend es nicht unterstützt; size-Feld ergänzen; „severity\" in „variant\" umbenennen. Docs (ui-badge.md, theming.md) anpassen"
epic: nodes/ui-badge
status: done
dependencies: [P49]
node: ui-badge
spec: docs/nodes/feedback/ui-badge.md
tests: tests/e2e/nodes/view/ui-badge.tests.md
---
# P92 — ui-badge Felder-Rework — displayType-Werte square/rounded/pill; „Max"-Feld ENTFERNEN (kein Countdown); „pulsating"-Checkbox + Warnung wenn Backend es nicht unterstützt; size-Feld ergänzen; „severity" in „variant" umbenennen. Docs (ui-badge.md, theming.md) anpassen

## Result

**Delivered:** ui-badge Felder-Rework: displayType changed to square/rounded/pill (shape vocabulary), `severity` renamed to `variant`, `max` field removed, `pulsating` (→ Shoelace `pulse`) and `size` (→ `data-size`) fields added; serializer, mapConfig, editor HTML, schema, runtime node-set, fixtures, editor package all updated; docs (ui-badge.md, theming.md) updated.

**Stats:** 16 files changed; 32 new unit tests (p92-badge-fields-rework.test.ts), 14 E2E tests (ui-badge.spec.ts rewritten), test catalogue ui-badge.tests.md added; total 892 unit tests pass; back-compat for old severity/count/dot/status fields via mapConfig migration.

**Notes:** sl-badge has no native `size` attribute in Shoelace 2.x — size is emitted as data-size for CSS targeting (documented in node help and spec). `severity` kept as back-compat field in mapConfig for old flows.

**Cost:** session a1b9d5c6-8aba-419a-92c5-2a9a194639c4, 13m
