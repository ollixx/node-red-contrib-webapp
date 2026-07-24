---
id: P270
title: "Node-Referenz-Batch feedback: Feedback-Knoten (7): alert, toast, progress, skeleton, badge, empty-state, log — Guide-Doc (EN+DE) + 1–3 Import-Beispiele + locales-Hilfe (en-US+de) + Editor-Label-i18n (data-i18n + Kataloge) je Knoten"
epic: aspects/docs
status: done
dependencies: [P265, P272]
verify: browser
spec: docs/guide/README.md
tests: tests/e2e/nodes/structure/ui-app.tests.md
---
# P270 — Node-Referenz-Batch: feedback

> Rationale: **[ADR 0042](../../../../adr/0042-user-docs-architecture-guide-tree-i18n-help-en-first-de.md)**.
> Mechanik, Templates, Smoke-Harness und Guardrails aus **P265** — dieses Paket
> füllt sie für die folgenden Knoten. Parallel zu den anderen Batches lauffähig
> (disjunkte Dateien).

## Knoten (7)

`ui-alert, ui-toast, ui-progress, ui-skeleton, ui-badge, ui-empty-state, ui-log`

## acceptance (je Knoten, nach den P265-Templates)

- **Guide-Doc** `docs/guide/nodes/<node>.md` (EN) + `docs/guide/de/nodes/<node>.md`:
  Purpose · When to use · **alle Felder mit Varianten** (user-level; Wahrheit aus
  dem Contract-Doc `docs/nodes/**`, das check:specs-verifiziert ist) · Inputs
  (msg-Verhalten wie im Konformitäts-Programm gemessen) · Outputs/Events ·
  **1–3 Import-Beispiele** (`examples/guide/…`, Import-Anleitung) · Related.
- **locales-Hilfe** `nodes/<cat>/locales/en-US/<node>.html` + `locales/de/<node>.html`
  nach Hilfe-Template (Purpose · Key fields · **Inputs-Pflichtabschnitt** ·
  Outputs · Guide-Link); der Inline-`data-help-name`-Block ist entfernt.
- **Editor-Label-i18n** (ADR 0042 §3, Mechanik + Key-Konvention aus **P272**):
  Formzeilen-Labels, knoten-eigene SelectBox-Optionstexte und knoten-eigene
  Hinweise via `data-i18n` + Kataloge `nodes/<cat>/locales/{en-US,de}/<node>.json`;
  Sprachumschaltung an mind. 1 Knoten des Batches gemessen; Label-Katalog-
  Guardrail-Allowlist um diese Knoten geleert. (Geteilte editor-common-Strings
  sind P272 — hier NICHT anfassen.)
- **Beispiele smoke-verifiziert** (Harness deployt + prüft Render).
- **Guardrail-Fortschritt:** die `check:guide`- und `check:help`-Allowlist-
  Einträge dieser Knoten sind entfernt (schrumpfend Richtung leer).
- `check:links` + `pnpm validate` grün; Stichprobe im Editor: Hilfe erscheint in
  beiden Sprachen (Sprachumschaltung, mind. 2 Knoten des Batches gemessen).

## Batch-spezifische Hinweise

- **ui-empty-state:** aktuellen Stand ehrlich dokumentieren + Hinweis auf geplantes Redesign (P152 deferred) — kein Versprechen.
- **ui-log:** forwardErrorsToClient-Voraussetzung prominent (P246-Ergebnis).
- **ui-skeleton:** die realen displayType-Formen aus dem P241-Ergebnis.

## verify

`browser` — Sprachumschaltungs-Stichprobe + alle Batch-Beispiele über den
Smoke-Harness; Guardrails grün mit geschrumpfter Allowlist.

## spec

Die Guide-Docs selbst; Contract-Docs bleiben unberührt (nur Quelle).

## tests

Smoke-Harness-Einträge; keine Verhaltens-Tests (Doku-Paket — Verhalten ist
durch das Konformitäts-Programm gedeckt).

## notes for the implementer

- **EN zuerst, DE im selben Paket** — nie einsprachig mergen (ADR 0042 §3).
- Bei Widerspruch Contract-Doc ↔ beobachtetem Verhalten: Contract prüfen,
  Widerspruch melden — NICHT in der Nutzer-Doku „glätten".
- Hilfe ist Zusammenfassung (Template-Deckel), kein Guide-Duplikat.

## Result

**Done 2026-07-24.** Der feedback-Batch ist durch — **7 Knoten migriert**, je ein
Commit (EN+DE).

### Geliefert

`c632053` ui-alert · `78f3cce` ui-toast · `12349d3` ui-progress · `d445c81`
ui-skeleton · `fbe773a` ui-badge · `50a459a` ui-empty-state · `98f20fa` ui-log;
Support `0727bd8`/`17d5722` (Test-Assertions).

Je Knoten Guide-Doc EN+DE, locales-Hilfe (Inline entfernt), Label-i18n-Kataloge,
smoke-verifiziertes Beispiel. **Ehrlichkeits-Fälle:** ui-log `forwardErrorsToClient`-
Voraussetzung prominent (P246); ui-skeleton reale P241-Formen + „msg.ui.patch nicht
unterstützt"; ui-toast duration/position (P254) + transientes-Beispiel-Heading
(P269-Lehre); ui-empty-state aktueller Stand + expliziter P152-Redesign-Vorbehalt.

### Contract-Widerspruch (gemeldet → Chip `task_f6546da5`)

`ui-empty-state.md` spezifiziert `action` als Node-Picker, `ui-empty-state.html`
implementiert ein Plain-Textfeld. Guide dokumentiert den ehrlichen Ist-Zustand;
Reconciliation als Chip (mit P152-Kopplungshinweis).

### Guardrail-Fortschritt

`check:guide`/`check:help`/label: **36 von 44** migriert, Allowlists 15 → **8**
(Rest: die 8 navigation-Knoten von P271). Smoke-Harness 40 → **47**.

### Verifikation

Agent-Voll-Lauf 952/1 (die 1 = ui-alert-color-N/A-Hint-Pin, locale-migration-Update,
gefixt). **Orchestrator-autoritativer Voll-Lauf nach Merge: 953 passed, 0 failed,
`--retries=0`, 17,2 min.** Alle Tripwires grün. Agent reapte proaktiv eine FREMDE
geleakte 1883-node-red (PID 7080); Ports leer; der Owner-node-red auf 1880 (Live-
Verbindungen) korrekt unangetastet.
