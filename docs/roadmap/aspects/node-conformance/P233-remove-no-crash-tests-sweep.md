---
id: P233
title: "Node-Konformität (Sweep): verbotene „renders without crashing\"-Tests durch echte Outcome-Assertions ersetzen — ~12 Knoten"
epic: aspects/node-conformance
status: in_progress
dependencies: []
verify: browser
spec: .ai/agents/node-testing.md
tests: tests/e2e/nodes/view/ui-progress.tests.md
---
# P233 — Sweep: „renders without crashing\"-Tests ersetzen

> Aus dem Audit-Sweep (2026-07-14). Cross-Cutting-Cleanup — `node-testing.md`
> verbietet Presence-/No-Crash-Tests ausdrücklich.

## findings

`.ai/agents/node-testing.md`: *„A 'renders without crashing' / DOM-presence-only
test is never acceptable"* — ein Test muss ein **beobachtbares Ergebnis** prüfen
und rot werden, wenn das Feature entfernt wird. Der Sweep fand solche Tests auf
**~12 Knoten**: ui-button, ui-container, ui-progress, ui-icon, ui-list,
ui-skeleton, ui-alert, ui-avatar, ui-badge, ui-breadcrumb, ui-empty-state,
ui-query.

## acceptance

- **Kein `ui-*`-Spec enthält mehr einen „renders without crashing\"/presence-only-
  Test.** Jeder solche Test wird **entfernt** und — falls sein Wegfall die
  Abdeckung eines realen Verhaltens senkt — durch **mindestens eine echte
  Outcome-Assertion** ersetzt (gerendertes Attribut/DOM-Struktur/emittierte
  Nachricht/Store-Wert), die rot wird, wenn das Feature fehlt.
- **Keine Netto-Abdeckungs-Lücke:** für jeden betroffenen Knoten bleibt das
  Kern-Rendering durch eine outcome-basierte Assertion abgedeckt (viele Knoten
  haben bereits solche Tests — dann genügt das Entfernen des No-Crash-Tests).
- **Kataloge aktuell:** die `.tests.md` der betroffenen Knoten spiegeln die
  Änderung.
- **Guardrail:** ein read-only Check, dass kein Spec `without crashing`/`renders
  without` (presence-only) enthält — damit das Muster nicht zurückkehrt.
- **E2E grün** (Haupt-Checkout).

## verify

`browser` — die ersetzten Assertions laufen im echten App/Editor; der Guardrail-
Check grün; keine `without crashing`-Vorkommen mehr.

## spec

`.ai/agents/node-testing.md` — ggf. den Guardrail referenzieren.

## tests

Die betroffenen `tests/e2e/nodes/**/<node>.spec.ts` + deren `.tests.md`.

## notes for the implementer

- Pro Knoten: den No-Crash-Test lesen, prüfen ob das Rendering anderswo outcome-
  basiert abgedeckt ist; wenn ja → entfernen; wenn nein → eine echte Assertion
  ergänzen (Muster: die bestehenden guten Tests desselben Knotens).
- **Nicht** die volle Testabdeckung neu aufbauen — das ist der spätere per-Knoten-
  Konformitäts-Pass. Hier nur: verbotenes Muster raus, minimale echte Deckung sichern.
- Sweep-Liste ist Startpunkt; der Guardrail findet danach alle Vorkommen verlässlich.
