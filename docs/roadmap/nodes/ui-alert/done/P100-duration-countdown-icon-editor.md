---
id: P100
title: "ui-alert: Duration/Countdown im Frontend, Icon-Custom-Option, Editor-Reihenfolge + Validierung"
epic: nodes/ui-alert
status: done
dependencies: [P90, P91]
node: ui-alert
verify: browser
spec: docs/nodes/feedback/ui-alert.md
tests: tests/e2e/nodes/view/ui-alert.tests.md
---
# P100 — ui-alert: Duration/Countdown im Frontend, Icon-Custom-Option, Editor-Reihenfolge + Validierung

## Findings
> Bericht des Owners, wörtlich.

- Duration führt im Frontend nicht zu einem Timeout und Ausblenden des Alerts.
- Countdown führt nicht zu einem Countdown im Frontend (Shoelace rendert eine Progressionbar rückwärts).
- Validierung fehlt: Countdown „on" ohne Duration ist nicht valide.
- Feld „Title" sollte über „Message" stehen.
- Unter „Message" eine Trennlinie.
- „Kein Icon" und „kein Icon explizit" macht keinen Sinn. Stattdessen eine Option „Custom", die den Button „Icon auswählen" anzeigt; ein Klick auf den Button öffnet den Icon-Auswahl-Dialog.

## Acceptance
> Beobachtbar, muss im laufenden Frontend bewiesen werden (`verify: browser`).

- Browser: ein Alert mit `duration=3000` blendet sich nach ~3s selbst aus (im DOM geschlossen/entfernt).
- Browser: bei aktivem Countdown nimmt der Fortschrittsbalken über die Duration sichtbar **ab** (leert sich) und erreicht 0 genau wenn der Alert ausgeblendet wird — Richtung „läuft ab", nicht „füllt sich". (Single source of truth: der Balken **depletiert**.)
- Editor: Countdown aktiviert ohne gesetzte Duration ⇒ Validierungsfehler vor Deploy (Knoten rot, Deploy blockiert).
- Editor-Screenshot: Feld „Title" steht über „Message"; direkt unter „Message" ist eine Trennlinie sichtbar.
- Editor: Icon-Auswahl bietet die Option „Custom". Ist „Custom" gewählt, erscheint der Button „Icon auswählen"; Klick öffnet den Icon-Auswahl-Dialog und die getroffene Auswahl wird übernommen. Die unsinnige Doppelung „kein Icon"/„kein Icon explizit" entfällt.

## Notes
- Backend-neutral halten: Shoelace nativ (`sl-alert` countdown/duration), Backends ohne native Unterstützung über dokumentierten Fallback (vgl. P91).

## Result

delivered:
- webapp-client.js: split sl-after-hide handler into dialog (P64) and alert (P100) branches; autoDismissed map prevents duration-expired alerts from reopening on snapshot morph
- ui-alert.html: countdown cross-field validator (countdown=true requires duration >= 1); icon select simplified to none/auto/custom with custom sentinel revealing icon-name input + icon picker button; Title moved above Message with hr separator after Message
- tests/e2e/nodes/view/ui-alert.spec.ts: full P100 suite (19 tests) covering duration auto-hide, countdown attr, editor validation, field order, separator, and icon Custom option

stats: 781 unit tests passed; build+lint+validate clean; 3 files changed
notes: E2E (verify:browser) to be run by orchestrator on develop after merge
cost: session aedcb56862d2f6d51, 4m
