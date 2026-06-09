---
id: P91
title: "ui-alert Duration + Countdown — Feld „Duration\" (positive Integer) + Checkbox „Countdown\" daneben (Shoelace nativ). Backends ohne native Unterstützung: Function-Fallback (Bootstrap-Doku-Beispiel). Gut dokumentieren (backend-neutral, offen für weitere Backends)"
epic: nodes/ui-alert
status: done
dependencies: [P16b]
node: ui-alert
spec: docs/nodes/feedback/ui-alert.md
tests: tests/e2e/nodes/view/ui-alert.tests.md
---
# P91 — ui-alert Duration + Countdown — Feld „Duration" (positive Integer) + Checkbox „Countdown" daneben (Shoelace nativ). Backends ohne native Unterstützung: Function-Fallback (Bootstrap-Doku-Beispiel). Gut dokumentieren (backend-neutral, offen für weitere Backends)

## Result

**Delivered:** Added `duration` (positive integer, ms) and `countdown` (boolean) fields to ui-alert — schema, mapConfig, serializer emits Shoelace-native `duration` and `countdown="ltr"` attrs, editor fields (number input + checkbox), and spec doc updated with backend-neutral documentation and fallback guidance.

**Stats:** 8 files changed, 300 insertions (+5 deletions); 15 new unit tests in p91-alert-duration-countdown.test.ts; 3 new schema tests; test catalogue .md updated; all 860 tests green

**Notes:** Shoelace natively supports both attrs on <sl-alert>; for other backends the doc and help text describe the JS-timeout + CSS-animation fallback (Bootstrap pattern). The `duration` schema uses z.number().int().positive() (>= 1).

**Cost:** session a8de0000c6723703b, 8m
