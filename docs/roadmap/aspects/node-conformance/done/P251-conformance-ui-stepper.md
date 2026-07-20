---
id: P251
node: ui-stepper
title: "Konformitäts-Pass ui-stepper (leicht) — `linear` ist totes Feld (Schema, nicht im Editor, unkonsumiert), orientation+`complete`-Event ungetestet; Kern solide"
epic: aspects/node-conformance
status: done
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

## Result

**Done 2026-07-20.** Leichter Pass — mit einem **echten Bug-Fund** (orientation war
inert, nicht nur ungetestet).

### `linear` → entfernt (Owner-Entscheid)

Totes Feld (nie im Editor, nie in `mapConfig` gelesen, nirgends konsumiert) aus Schema
+ Spec entfernt. **Legacy-`linear` verlustfrei:** `mapConfig` liest es nie → erreicht
die Runtime-Definition nicht; das Stepper-Schema ist ein plain (nicht-`.strict()`)
Zod-Objekt → unbekannter `linear`-Key wird still gestrippt, kein Validierungsfehler.

### `orientation` — gemessen und **als kaputt gefunden** → gefixt

Die `orientation`→`variant`-Abbildung (`mapConfig`: `variant: config.orientation`)
speichert den Wert in `props.variant`, aber der Serializer las `props.orientation`
(nie befüllt) → `webapp-stepper--<orientation>` **defaultete immer auf `horizontal`**.
Orientation war **inert, nicht nur ungetestet** (das Roadmap-Finding untertrieb).
Fix: Serializer liest jetzt `component.variant || props.variant || props.orientation
|| "horizontal"`; CSS-Regel (`--horizontal` → row, `--vertical` → column) gibt der
Klasse beobachtbare Wirkung; **gemessener** E2E O01: horizontal → 2. Button rechts vom
1. (x steigt, gemeinsame Oberkante), vertical → 2. Button unter dem 1. (y steigt,
gemeinsame linke Kante), Bounding-Box auf beiden Achsen. Ohne den Serializer-Fix
schlägt der Test fehl (vertical rendert als horizontal — so wurde der Bug gefangen).

### `complete`-Event — gemessen inert → entfernt (Back-Compat)

Kein DOM-Source emittiert `complete` (`grep -a` Serializer/Client + Runtime leer; der
p85-„complete"-Unit-Test injizierte nur ein synthetisches Event via
`dispatchClientEvent`, am DOM vorbei). Aus dem `events`-Enum entfernt (jetzt
`["stepChange"]`); `filterSupportedStepperEvents` in `webapp.js` (Allowlist
`{stepChange, change}`, mirror P249) filtert Legacy-`complete` → Alt-Flows deployen
weiter. p85-Unit angepasst; Node-Beispiel regeneriert (2 → 1 Output-Port).

### Verifikation (Haupt-Checkout, autoritativ)

**E2E 806 passed, 0 failed, `--retries=0`, 15,2 min** (E01 diesmal grün — bestätigt
die Intermittenz aus P250, kein Code-Bezug). Schema+Serializer+webapp.js geändert →
Voll-Suite gerechtfertigt. `pnpm build` + `pnpm validate` + Tripwires grün. Agent
committete VOR der Verifikation, stoppte alle Prozesse (Port 1882 frei), Haupt-Checkout
unberührt.

### Nebenbefund

Der Serializer-Key-Mismatch (`props.orientation` vs `props.variant`) zeigt: ein
„gerendert aber ungetestet"-Finding kann in Wahrheit **inert** sein — „prove it" wurde
zu „fix, dann prove". Messen deckt auf, was Code-Lesen (mapConfig trägt variant durch)
suggeriert, aber der Serializer nicht einlöst.
