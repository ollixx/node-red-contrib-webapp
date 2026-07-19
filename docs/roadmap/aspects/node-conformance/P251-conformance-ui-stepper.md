---
id: P251
node: ui-stepper
title: "Konformitäts-Pass ui-stepper (leicht) — `linear` ist totes Feld (Schema, nicht im Editor, unkonsumiert), orientation+`complete`-Event ungetestet; Kern solide"
epic: aspects/node-conformance
status: pending
dependencies: []
verify: browser
spec: docs/nodes/navigation/ui-stepper.md
tests: tests/e2e/nodes/view/ui-stepper.tests.md
---
# P251 — Konformitäts-Pass ui-stepper (leicht)

> Audit 2026-07-17. Kern **solide** — 8 outcome-E2E (Steps→Buttons, aktiver Step,
> `activeStep`, Klick-Event, Zwei-Wege-Write-Back, SSE, Legacy-`activeStepPath`-
> Migration), Base-Fields, Katalog.

## findings

### A. `linear` ist ein totes Feld
Schema `linear: z.boolean().optional()` (linearer Stepper — Steps nicht
überspringbar). Aber: **nicht** in den Editor-`defaults` (steps/activeStep/
orientation/events — kein `linear`) **und** nirgends konsumiert (grep in Serializer/
Renderer/webapp.js leer). ⇒ Weder setzbar noch durchgesetzt: totes Feld.
Entscheidung: implementieren (Schritt-Sperre bis vorheriger abgeschlossen) **oder**
aus Schema+Spec entfernen.

### B. `orientation` gerendert, aber ungetestet
`variant`/`orientation` (horizontal/vertical) **wird** gerendert
(`webapp-serializer.js:1379` → `webapp-stepper--<orientation>`-Klasse), aber kein
Test prüft den Unterschied. (Namens-Notiz: Editor-Feld `orientation` → Schema
`variant` via `variant: config.orientation` in mapConfig — dokumentieren.)

### C. `complete`-Event ungetestet
`events: ["stepChange","complete"]`. E2E deckt `change` (Step-Klick); **`complete`**
(letzter Step erreicht/abgeschlossen) ist nicht belegt — Existenz zu verifizieren.

### D. Solide (nicht neu aufbauen)
Steps-Render, aktiver Step, activeStep-Binding (alle Arten + Zwei-Wege + SSE),
Klick-Event, Legacy-Migration.

## acceptance
- **`linear` aufgelöst:** implementiert (beobachtbare Schritt-Sperre + Test) **oder**
  aus Schema+Spec entfernt.
- **`orientation` getestet:** horizontal vs vertical erzeugt gemessenen Layout-
  Unterschied; die `orientation`↔`variant`-Abbildung ist dokumentiert.
- **`complete`-Event:** Verhaltens-E2E (letzter Step → `complete`-Envelope) — oder,
  falls nicht implementiert, aus Schema+Spec entfernt.
- **E2E grün**; Tripwires + `pnpm validate` grün.

## verify
`browser` — linear/orientation/complete gemessen; die 8 bestehenden bleiben grün.

## spec
`docs/nodes/navigation/ui-stepper.md` — linear-Entscheid, orientation-Wirkung +
Feldnamen-Abbildung, complete-Verhalten.

## tests
`tests/e2e/nodes/view/ui-stepper.spec.ts` + Katalog.
