---
id: P73
title: "Bugfix: Serializer rendert gemappte Felder nicht — ui-switch `labelOn`/`labelOff`, ui-slider `showValue` (in Schema+mapConfig, aber nicht im webapp-serializer.js), ui-datepicker `mode` datetime/time degradiert still zu type=date. Rendering ergänzen + E2E"
epic: aspects/test-infra
status: done
dependencies: [P26]
---
# P73 — Bugfix: Serializer rendert gemappte Felder nicht — ui-switch `labelOn`/`labelOff`, ui-slider `showValue` (in Schema+mapConfig, aber nicht im webapp-serializer.js), ui-datepicker `mode` datetime/time degradiert still zu type=date. Rendering ergänzen + E2E

## Result

**Delivered:** Fixed three serializer bugs: ui-switch labelOn/labelOff now rendered as sl-switch label-on/label-off attributes; ui-slider showValue now suppresses Shoelace tooltip (tooltip=none) when false/absent; ui-datepicker mode now maps to correct HTML input type (datetime→datetime-local, time→time) instead of hardcoded type=date.

**Stats:** 2 source files changed (nodes/webapp.js props assembly + webapp-serializer.js render), 4 new test files, 11 unit + 8 E2E tests added; 360 unit, 293 E2E passing.

**Notes:** Root cause: labelOn/labelOff and mode were in schema+mapConfig but omitted from the props assembly block in webapp.js (~line 975). showValue was already assembled into props but never rendered in the serializer. For showValue/Shoelace: sl-range shows tooltip by default, so showValue=false requires tooltip=none rather than a positive attribute.


**Cost:** session a0c52ca21bbd75549, 25m
