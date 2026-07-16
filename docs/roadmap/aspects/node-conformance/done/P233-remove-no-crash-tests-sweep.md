---
id: P233
title: "Node-Konformität (Sweep): verbotene „renders without crashing\"-Tests durch echte Outcome-Assertions ersetzen — ~12 Knoten"
epic: aspects/node-conformance
status: done
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

## Result

**Delivered.** Alle verbotenen „renders without crashing"/presence-only-Tests entfernt bzw. durch echte Outcome-Assertions ersetzt (12 Knoten) + Guardrail. Test-Seite only, kein Verhaltens-/Feld-Change.
- **Ersetzt** (echte Assertion): ui-progress (Default-Wert `sl-progress-bar=0`), ui-breadcrumb (leere items → 0 items, Sibling rendert), ui-button (Default-Label „Button" gerendert — Orchestrator-Korrektur: der Agent riet fälschlich Node-id-Fallback), ui-icon (kein-Icon → eigenes leeres Wrapper-Fragment, kein `sl-icon`), ui-container (grid-Preset → `.webapp-layout--grid`), ui-list composite (leere items → 0 `li`).
- **Gelöscht** (Rendering anderswo outcome-abgedeckt): ui-empty-state ×2, ui-skeleton ×2 (rendern Leerstring; Sibling-Content-Test bleibt).
- **Nur umbenannt** (waren schon outcome-basiert): ui-list view, ui-badge, ui-avatar, ui-query.
- **Guardrail** `scripts/check-no-crash.js` (`pnpm check:no-crash`, in `validate`+`test:specs`): scannt alle `tests/e2e/**/*.spec.ts` auf `without crashing`/`renders? without`, non-zero-Exit mit file:line, pure Core, unit-getestet (`check-no-crash.test.ts`, 10 Tests), leere Allowlist. 125 Specs, 0 Treffer. Kataloge der betroffenen Knoten aktualisiert.

**Verify (browser, gemessen — Haupt-Checkout).** Alle 12 betroffenen Specs grün (112 passed nach Merge; die eine rote Agent-Fehlannahme in ui-button vom Orchestrator gefixt → 12/12). `pnpm check:no-crash` grün (125/0), `check:specs`/`check:fields`/`check:help`/`check:roundtrip`/`check:links`/`check:roadmap`/`pnpm validate` grün.

**Cost.** Sub-Agent `phase/P233` (worktree), ~16 min + Orchestrator-E2E-Verifikation & ui-button-Fix. Token-Zeile in `.ai/agent-runs.jsonl`.
