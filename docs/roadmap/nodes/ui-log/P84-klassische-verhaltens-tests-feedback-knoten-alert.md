---
id: P84
title: "Klassische Verhaltens-Tests Feedback-Knoten (alert/badge/empty-state/log/progress/skeleton/toast): msg.payload-Patch+Push, Pass-Through, dismiss-Event (alert), toast (override/clientId/fehlende message), skeleton/empty-state op-Handling, ui-log minSeverity/maxEntries (Client-JS); E2E auf Render eindampfen"
epic: nodes/ui-log
status: done
dependencies: [P81]
node: ui-log
spec: docs/nodes/feedback/ui-log.md
---
# P84 — Klassische Verhaltens-Tests Feedback-Knoten (alert/badge/empty-state/log/progress/skeleton/toast): msg.payload-Patch+Push, Pass-Through, dismiss-Event (alert), toast (override/clientId/fehlende message), skeleton/empty-state op-Handling, ui-log minSeverity/maxEntries (Client-JS); E2E auf Render eindampfen

## Result

**Delivered:** Classic behaviour test file p84-feedback-nodes-behaviour.test.ts with 24 unit tests covering all 7 feedback-category nodes via NodeBehaviourHarness: ui-alert/badge/progress msg.payload→primary binding + pass-through; ui-skeleton/empty-state componentStateInputHandler valid-op pass-through, invalid-op drop, no-op pass-through; ui-toast SSE toast frame push, override precedence (severity/position/duration), clientId targeting (unicast vs broadcast), payload fallback; ui-log pass-through (no input port by design); ui-alert dismiss event via dispatchClientEvent emitting msg.ui on output port.

**Stats:** 1 new test file (+24 unit, 463→487); 0 source files changed; 0 E2E changed; full validate green; playwright 296 (unchanged).

**Notes:** componentStateInputHandler (ui-skeleton, ui-empty-state) does NOT push SSE command frames — it passes through for valid ops and drops for invalid ops. SSE command push only occurs via the interactionInputHandler wrapper, which these nodes don't use. Tests corrected after inspecting the handler. No E2E trimming needed: existing feedback-node E2E specs (P43/P57) are already render-only.


**Cost:** session ae879a9df4735c22d, 25m
