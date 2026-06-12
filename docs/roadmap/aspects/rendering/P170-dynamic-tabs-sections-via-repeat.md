---
id: P170
epic: aspects/rendering
title: "Dynamische Tabs/Sektionen via ui-repeat: ein ui-repeat erzeugt ui-tab/ui-accordion-section-Kinder aus Daten (Capstone, kein eigener Dynamik-Mechanismus)"
findings:
  - "Owner (2026-06-11): 'die slots werden nicht angezeigt … Das ist dann ja auch dynamisch, wenn man die options dynamisch füllt.'"
  - "Owner-Entscheidung (2026-06-12): in Modell 1a fällt der dynamische Fall aus ui-repeat — keine eigene 'dynamischer-Slot'-Bindung."
acceptance:
  - "Ein ui-repeat mit items=Store-Array, dessen Template ein ui-tab (label = item.<feld>) ist, rendert N Tabs — einen pro Datensatz."
  - "Array-Änderung (Item hinzu/weg/umsortiert) ändert die Tab-Menge sichtbar; keyed (kein Flackern der unveränderten Tabs); activeTab bleibt stabil, solange das Kind existiert."
  - "Gleicher Nachweis für ui-accordion + ui-accordion-section."
  - "Kein neuer Binding-/Slot-Mechanismus eingeführt — der Effekt entsteht allein aus ui-repeat (ADR 0017) + Kinder-definieren-Sektionen (ADR 0018)."
verify: browser
spec: docs/nodes/navigation/ui-tabs.md
tests: tests/e2e/nodes/view/ui-tabs.tests.md
dependencies: [P165, P168, P169]
status: in_progress
---
# P170 — Dynamische Tabs/Sektionen via ui-repeat (Capstone)

> Schließt P142 endgültig: der **dynamische** Teil ist kein eigenes Feature,
> sondern die **Komposition** aus `ui-repeat` (ADR 0017) und Kinder-definieren-
> Sektionen (ADR 0018). Dieses Paket **beweist** die Komposition end-to-end und
> dokumentiert das Muster — es baut idealerweise **keinen** neuen Mechanismus.

## Umfang

1. **Verifizieren:** ui-repeat (Template = `ui-tab`, `label = item.<feld>`)
   innerhalb eines `ui-tabs` → N Tabs aus Daten; dito `ui-accordion` mit
   `ui-accordion-section`.
2. **Keying/Stabilität:** Repeat-Keys × Sektions-id; `activeTab`/Open-Zustand
   übersteht Datenänderungen, solange das Kind existiert.
3. **Lücken schließen, falls vorhanden:** sollte die Komposition an einer Stelle
   nicht greifen (z. B. Repeat-Kinder werden vom Container nicht als Sektionen
   erkannt), dort den **minimalen** Fix machen — aber **kein** paralleles
   Dynamik-Modell einführen.
4. **Doku:** das Muster „dynamische Tabs = ui-repeat von ui-tab" in
   `ui-tabs.md`/`ui-accordion.md` + ein Beispiel dokumentieren.

## acceptance / verify

- `verify: browser` — E2E im Haupt-Checkout durch den Orchestrator
  ([[orchestrator-must-verify-e2e-in-main-checkout]]).

## Risiken / Hinweise

- Hängt an der **ui-repeat-Welle (P165)** und an P168/P169 — erst ziehbar, wenn
  beide stehen.
- Leitprinzip: **Komposition statt neuem Mechanismus**. Wenn dieses Paket viel
  neuen Code braucht, stimmt etwas an ADR 0017/0018 nicht — dann zurückmelden.
